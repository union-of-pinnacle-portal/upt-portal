import "server-only";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws/dynamo";
import { BY_RANK_INDEX, TABLE_NAME } from "@/lib/aws/config";
import type { Rank } from "@/lib/roles";

export type DocumentStatus = "draft" | "published" | "archived";

/**
 * A document as stored under `pk = sk = DOC#<id>` (see infra data model).
 * `minRank` is the lowest rank allowed to view it and is the partition key of
 * the `by-rank` GSI that serves the role-based list.
 */
export interface PortalDocument {
  id: string;
  title: string;
  description?: string;
  category: string;
  minRank: Rank;
  status: DocumentStatus;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** DynamoDB primary key for a document id. */
function docKey(id: string) {
  return { pk: `DOC#${id}`, sk: `DOC#${id}` };
}

/**
 * List every PUBLISHED document a member of the given rank may view, newest
 * first. A rank sees all documents whose `minRank` is at or below its own, so
 * we query each eligible `minRank` partition of the `by-rank` GSI (at most
 * three) and merge-sort by `updatedAt`. Fine for P0's low document volume.
 *
 * Draft and archived documents are excluded — regular members never see them.
 */
export async function listPublishedForRank(
  rank: Rank,
): Promise<PortalDocument[]> {
  const visibleRanks = [1, 2, 3].filter((r) => r <= rank);

  const perRank = await Promise.all(
    visibleRanks.map((r) =>
      ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: BY_RANK_INDEX,
          KeyConditionExpression: "minRank = :r",
          // `status` is a DynamoDB reserved word — alias it.
          FilterExpression: "#status = :published",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":r": r, ":published": "published" },
          ScanIndexForward: false,
        }),
      ),
    ),
  );

  return perRank
    .flatMap((res) => (res.Items ?? []) as PortalDocument[])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Fetch a single document by id, or null if it does not exist. */
export async function getDocument(id: string): Promise<PortalDocument | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: docKey(id) }),
  );
  return (res.Item as PortalDocument | undefined) ?? null;
}
