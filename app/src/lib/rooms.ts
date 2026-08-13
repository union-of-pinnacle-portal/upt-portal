import "server-only";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { TABLE_NAME } from "@/lib/aws/config";
import { rankForRole, toRole, type Role } from "@/lib/roles";

/**
 * Committee Rooms — the write-scoping layer.
 *
 * A room is a committee's container for documents ("Housing", "Legal",
 * "Outreach"). It scopes **writes only**:
 *
 *   READ  is global and rank-based (see lib/roles.ts). A member sees every
 *         document at or below their rank, in any room. Rooms do not hide
 *         anything.
 *   WRITE is room-scoped. Uploading or editing a document requires membership
 *         of the room it lives in — except for Super Users, who write anywhere.
 *
 * ONE ROLE, MANY ROOMS. A user has a single global role (in SuperTokens
 * UserMetadata) which fixes their rank and therefore what they can read.
 * Membership does not carry its own role; it says *where* the user's role
 * applies for writing. So a Committee Chair assigned to Housing and Legal is a
 * Chair in both. This is what the spec describes ("...within Committee Room
 * assigned") and avoids a second, conflicting role dimension — at the cost of
 * not being able to make someone a Chair of one room and a plain Member of
 * another. Revisit if that case turns up.
 *
 * STORAGE (single-table, see infra/README):
 *   Room        pk = `ROOMS`         sk = `ROOM#<id>`
 *   Membership  pk = `USER#<email>`  sk = `ROOM#<id>`      (authz lookups)
 *   ...mirrored pk = `ROOM#<id>`     sk = `MEMBER#<email>` (room roster)
 *
 * Rooms share one partition (`ROOMS`) so listing them is a single Query with no
 * new GSI. A union has a handful of committees, not thousands, so the hot-
 * partition concern does not apply. Memberships are written to both key shapes
 * in one transaction because both directions are needed — per-user for the
 * authz check on every write, per-room for the Chair's roster UI.
 */

/** Partition holding every room item, so `listRooms` is one Query. */
const ROOMS_PK = "ROOMS";

export interface CommitteeRoom {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface RoomMembership {
  roomId: string;
  email: string;
  assignedBy: string;
  assignedAt: string;
}

function roomKey(id: string) {
  return { pk: ROOMS_PK, sk: `ROOM#${id}` };
}

function membershipByUserKey(email: string, roomId: string) {
  return { pk: `USER#${email}`, sk: `ROOM#${roomId}` };
}

function membershipByRoomKey(roomId: string, email: string) {
  return { pk: `ROOM#${roomId}`, sk: `MEMBER#${email}` };
}

/* ------------------------------------------------------------------ *
 * Permission predicates
 * ------------------------------------------------------------------ */

/** Only Super Users create Committee Rooms. */
export function canCreateRooms(role: unknown): boolean {
  return toRole(role) === "committee_head";
}

/** Super Users write in every room, without needing membership. */
export function writesEverywhere(role: unknown): boolean {
  return toRole(role) === "committee_head";
}

/**
 * Whether a role is capable of writing *at all*, before room membership is
 * considered. General Members are read-only at every rank, everywhere — no
 * room assignment can grant them write access.
 */
export function roleCanWrite(role: unknown): boolean {
  return rankForRole(role) >= 2;
}

/**
 * Whether a role may assign members within a room it belongs to. Chairs manage
 * their own room's roster; Super Users manage any.
 */
export function roleCanAssignMembers(role: unknown): boolean {
  return rankForRole(role) >= 3;
}

/**
 * THE room-scoped write check — call before any create/edit of a document.
 *
 * `roomId` is the room the document lives in (or will live in). Documents
 * predating Committee Rooms have no room; they are "unfiled" and only Super
 * Users may write them, which is the same audience that could write them
 * before rooms existed. That keeps the migration a no-op for existing content
 * rather than silently handing it to whoever joins a room first.
 */
export async function canWriteInRoom(
  user: { email: string; role: Role },
  roomId: string | undefined,
): Promise<boolean> {
  if (writesEverywhere(user.role)) return true;
  if (!roleCanWrite(user.role)) return false;
  // Unfiled document: Super Users only, and we already returned for those.
  if (!roomId) return false;
  return isRoomMember(user.email, roomId);
}

/**
 * Whether a user may manage a room's roster (add/remove members). Super Users
 * may manage any room; Chairs only rooms they belong to.
 */
export async function canAssignInRoom(
  user: { email: string; role: Role },
  roomId: string,
): Promise<boolean> {
  if (writesEverywhere(user.role)) return true;
  if (!roleCanAssignMembers(user.role)) return false;
  return isRoomMember(user.email, roomId);
}

/* ------------------------------------------------------------------ *
 * Rooms
 * ------------------------------------------------------------------ */

export interface CreateRoomInput {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
}

/** Create a room. The condition guards against reusing an existing id. */
export async function createRoom(
  input: CreateRoomInput,
): Promise<CommitteeRoom> {
  const room: CommitteeRoom = {
    ...input,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...roomKey(input.id), ...room },
      ConditionExpression: "attribute_not_exists(sk)",
    }),
  );

  return room;
}

/**
 * Delete a Committee Room and all its memberships.
 * Super Users only. Documents in the room become unfiled (roomId removed).
 */
export async function deleteRoom(id: string): Promise<void> {
  const members = await listRoomMembers(id);

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: roomKey(id),
          },
        },
        ...members.map((m) => ({
          Delete: {
            TableName: TABLE_NAME,
            Key: membershipByRoomKey(id, m.email),
          },
        })),
        ...members.map((m) => ({
          Delete: {
            TableName: TABLE_NAME,
            Key: membershipByUserKey(m.email, id),
          },
        })),
      ],
    }),
  );
}

/** Every room, alphabetically by name. */
export async function listRooms(): Promise<CommitteeRoom[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": ROOMS_PK },
    }),
  );

  return ((res.Items ?? []) as CommitteeRoom[]).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Fetch a single room, or null if it does not exist. */
export async function getRoom(id: string): Promise<CommitteeRoom | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: roomKey(id) }),
  );
  return (res.Item as CommitteeRoom | undefined) ?? null;
}

/* ------------------------------------------------------------------ *
 * Membership
 * ------------------------------------------------------------------ */

/**
 * Assign a user to a room. Writes both key shapes atomically so the per-user
 * and per-room views can never disagree. Re-assigning an existing member is a
 * harmless overwrite (it refreshes assignedBy/assignedAt).
 */
export async function addRoomMember(
  roomId: string,
  email: string,
  assignedBy: string,
): Promise<RoomMembership> {
  const membership: RoomMembership = {
    roomId,
    email,
    assignedBy,
    assignedAt: new Date().toISOString(),
  };

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: { ...membershipByUserKey(email, roomId), ...membership },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: { ...membershipByRoomKey(roomId, email), ...membership },
          },
        },
      ],
    }),
  );

  return membership;
}

/** Remove a user from a room, clearing both key shapes atomically. */
export async function removeRoomMember(
  roomId: string,
  email: string,
): Promise<void> {
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: membershipByUserKey(email, roomId),
          },
        },
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: membershipByRoomKey(roomId, email),
          },
        },
      ],
    }),
  );
}

/** Whether a user belongs to a room. The hot path for every write check. */
export async function isRoomMember(
  email: string,
  roomId: string,
): Promise<boolean> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: membershipByUserKey(email, roomId),
      ProjectionExpression: "pk",
    }),
  );
  return res.Item !== undefined;
}

/** The rooms a user belongs to. */
export async function listRoomsForUser(
  email: string,
): Promise<RoomMembership[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${email}`,
        ":prefix": "ROOM#",
      },
    }),
  );
  return (res.Items ?? []) as RoomMembership[];
}

/** A room's roster, alphabetically by email. */
export async function listRoomMembers(
  roomId: string,
): Promise<RoomMembership[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `ROOM#${roomId}`,
        ":prefix": "MEMBER#",
      },
    }),
  );
  return ((res.Items ?? []) as RoomMembership[]).sort((a, b) =>
    a.email.localeCompare(b.email),
  );
}

/**
 * The rooms a user may write into, for UI that must offer a choice (the upload
 * form's room picker). Super Users get every room; everyone else gets their
 * assigned rooms; read-only roles get none.
 */
export async function listWritableRooms(user: {
  email: string;
  role: Role;
}): Promise<CommitteeRoom[]> {
  if (!roleCanWrite(user.role)) return [];

  const all = await listRooms();
  if (writesEverywhere(user.role)) return all;

  const memberships = await listRoomsForUser(user.email);
  const mine = new Set(memberships.map((m) => m.roomId));
  return all.filter((room) => mine.has(room.id));
}
