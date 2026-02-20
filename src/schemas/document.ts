import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/pg-core";
import { text, serial, pgTable, vector, index } from "drizzle-orm/pg-core";

export const documentFragmentTable = pgTable(
  "document_fragment",
  {
    id: serial("id").primaryKey(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 384 }).notNull(),
    docId: integer("docId").notNull(),
  },
  (table) => [
    index("doc_index").using("btree", table.docId),
    index("text_index").using(
      "gin",
      sql`to_tsvector('english', ${table.text})`,
    ),
    index("embedding_index")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .with({
        ef_construction: 256,
      }),
  ],
);
