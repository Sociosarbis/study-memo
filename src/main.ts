import {
  AutoModel,
  AutoTokenizer,
  env,
  mean_pooling,
  PretrainedConfig,
  Tensor,
} from "@huggingface/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { documentFragmentTable } from "./schemas/document";
import { desc, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";

config({ path: ".env" });

const modelIdToConfig: Record<string, PretrainedConfig> = {
  "BAAI/bge-m3": new PretrainedConfig({
    _name_or_path: "",
    architectures: ["XLMRobertaModel"],
    attention_probs_dropout_prob: 0.1,
    bos_token_id: 0,
    classifier_dropout: null,
    eos_token_id: 2,
    hidden_act: "gelu",
    hidden_dropout_prob: 0.1,
    hidden_size: 1024,
    initializer_range: 0.02,
    intermediate_size: 4096,
    layer_norm_eps: 1e-5,
    max_position_embeddings: 8194,
    model_type: "xlm-roberta",
    num_attention_heads: 16,
    num_hidden_layers: 24,
    output_past: true,
    pad_token_id: 1,
    position_embedding_type: "absolute",
    torch_dtype: "float32",
    transformers_version: "4.33.0",
    type_vocab_size: 1,
    use_cache: true,
    vocab_size: 250002,
    "transformers.js_config": {
      use_external_data_format: {
        "model.onnx": 1,
      },
    },
  }),
};

function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sql });
}

async function generateEmbedding(text: string) {
  const db = createDb();
  const documentTexts = await new RecursiveCharacterTextSplitter({
    chunkSize: 128,
    chunkOverlap: 25,
  }).splitText(text);
  env.remoteHost = "https://modelscope.cn";
  const modelId = "sentence-transformers/all-MiniLM-L6-v2";
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const inputs: {
    input_ids: Tensor;
    attention_mask: Tensor;
    token_type_ids: Tensor;
  } = tokenizer(documentTexts, { padding: true });
  const model = await AutoModel.from_pretrained(modelId, {
    dtype: "fp32",
    config: modelIdToConfig[modelId],
    progress_callback: (info) => console.log(info),
  });
  const output: { last_hidden_state: Tensor } = await model(inputs);
  const embeddingsTensor = mean_pooling(
    output.last_hidden_state,
    inputs.attention_mask,
  );
  const embeddings: Array<number[]> = [];
  for (let i = 0; i < embeddingsTensor.dims[0]; i++) {
    embeddings.push(
      embeddingsTensor
        .slice([i, i + 1])
        .squeeze(0)
        .tolist(),
    );
  }
  return embeddings;
}

// generateEmbedding(`The project aims to train sentence embedding models on very large sentence level datasets using a self-supervised contrastive learning objective. We used the pretrained nreimers/MiniLM-L6-H384-uncased model and fine-tuned in on a 1B sentence pairs dataset. We use a contrastive learning objective: given a sentence from the pair, the model should predict which out of a set of randomly sampled other sentences, was actually paired with it in our dataset.

// We developed this model during the Community week using JAX/Flax for NLP & CV, organized by Hugging Face. We developed this model as part of the project: Train the Best Sentence Embedding Model Ever with 1B Training Pairs. We benefited from efficient hardware infrastructure to run the project: 7 TPUs v3-8, as well as intervention from Googles Flax, JAX, and Cloud team member about efficient deep learning frameworks.`);

async function getRelatedFragments(keyword: string) {
  const db = createDb();
  const embeddings = await generateEmbedding(keyword);
  console.log(
    await db
      .select({
        id: sql`searches.id`,
        text: sql`searches.text`,
        score: sql`sum(rrf_score(searches.rank::integer))`.as("score"),
      })
      .from(
        db
          .select({
            id: documentFragmentTable.id,
            text: documentFragmentTable.text,
            rank: sql`rank() over (order by ts_rank_cd(to_tsvector(${documentFragmentTable.text}), plainto_tsquery(${keyword})) desc)`.as(
              "rank",
            ),
          })
          .from(documentFragmentTable)
          .where(
            sql`plainto_tsquery('english', ${keyword}) @@ to_tsvector('english', ${documentFragmentTable.text})`,
          )
          .orderBy(sql`rank`)
          .limit(40)
          .unionAll(
            db
              .select({
                id: documentFragmentTable.id,
                text: documentFragmentTable.text,
                rank: sql`rank() over (order by ${cosineDistance(documentFragmentTable.embedding, embeddings[0])})`.as(
                  "rank",
                ),
              })
              .from(documentFragmentTable)
              .orderBy(sql`rank`)
              .limit(40),
          )
          .as("searches"),
      )
      .groupBy(sql`searches.id`, sql`searches.text`)
      .orderBy(desc(sql`score`))
      .limit(10),
  );
}

getRelatedFragments("model weights");
