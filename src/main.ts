import {
  pipeline,
  AutoModel,
  AutoTokenizer,
  env,
} from "@huggingface/transformers";

async function generateEmbedding(text: string) {
  env.remoteHost = "https://modelscope.cn";
  const tokenizer = await AutoTokenizer.from_pretrained(
    "sentence-transformers/all-MiniLM-L6-v2",
  );
  const inputs = tokenizer.encode(text);
  const model = await AutoModel.from_pretrained(
    "sentence-transformers/all-MiniLM-L6-v2",
    { dtype: "fp32", device: "gpu" },
  );
  const output = await model.forward(inputs);
  console.log(output);
}

generateEmbedding("你好，世界");
