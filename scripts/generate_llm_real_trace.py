#!/usr/bin/env python3
"""Make a real, source-traceable LLM execution snapshot for the EAI observatory.

This is an OFFLINE/CI producer, not a runtime model dependency.
The model is NOT gpt-oss, has no Mixture-of-Experts router, and uses its own tokenizer.
A snapshot is valid only for the EXACT displayed English prompt.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

MODEL_ID = "EphAsad/IllaryiaStories-1M"
PROMPT = "Once upon a time,"
STEPS = 4
TOP_K = 8
SOURCE_URL = f"https://huggingface.co/{MODEL_ID}"


def _pieces(tokenizer, ids):
    return [
        {"id": int(i), "text": tokenizer.decode([int(i)], clean_up_tokenization_spaces=False)}
        for i in ids
    ]


def export(out: Path):
    import torch
    from huggingface_hub import HfApi, snapshot_download
    from transformers import AutoModelForCausalLM, AutoTokenizer

    torch.set_num_threads(2)
    torch.manual_seed(0)
    info = HfApi().model_info(MODEL_ID)
    revision = info.sha
    folder = Path(snapshot_download(
        repo_id=MODEL_ID,
        revision=revision,
        allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model"],
    ))
    weight_file = folder / "model.safetensors"
    if not weight_file.is_file():
        raise RuntimeError("Safetensors checkpoint missing. Never load an unverified pickle instead.")
    checksum = hashlib.sha256(weight_file.read_bytes()).hexdigest()

    tokenizer = AutoTokenizer.from_pretrained(str(folder), use_fast=True, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(
        str(folder),
        trust_remote_code=False,
        attn_implementation="eager",
        torch_dtype=torch.float32,
    )
    model.eval()
    if model.config.model_type != "gpt_neo":
        raise RuntimeError(f"Unexpected model architecture: {model.config.model_type}")

    ids = list(tokenizer.encode(PROMPT, add_special_tokens=False))
    if not ids:
        raise RuntimeError("Prompt has no tokens")
    generated = []
    steps = []
    with torch.inference_mode():
        for number in range(STEPS):
            input_ids = torch.tensor([ids], dtype=torch.long)
            result = model(
                input_ids=input_ids,
                output_hidden_states=True,
                output_attentions=True,
                use_cache=False,
                return_dict=True,
            )
            if not result.attentions or not result.hidden_states:
                raise RuntimeError("This model did not expose genuine internal activations")
            attention_layers = len(result.attentions)
            hidden_layers = len(result.hidden_states) - 1
            if attention_layers != model.config.num_layers or hidden_layers != attention_layers:
                raise RuntimeError("Inconsistent number of measured layers")

            probs = result.logits[0, -1].float().softmax(dim=-1)
            top = torch.topk(probs, k=TOP_K)
            chosen = int(top.indices[0].item())
            weight = model.transformer.wte(input_ids)[0, -1].float()
            absolute = model.transformer.wpe(
                torch.tensor([[len(ids)-1]], dtype=torch.long)
            )[0, 0].float()
            head0 = result.attentions[0][0, 0, -1].float()
            headlast = result.attentions[-1][0, 0, -1].float()
            if abs(float(head0.sum().item()) - 1) > 1e-4:
                raise RuntimeError("Attention weights must add up to one")

            layers = []
            for layer_idx, values in enumerate(result.hidden_states):
                current = values[0, -1].float()
                layers.append({
                    "index": layer_idx,
                    "norm": round(float(torch.linalg.vector_norm(current)), 6),
                    "first": [round(float(x), 6) for x in current[:8].tolist()],
                })
            step = {
                "index": number,
                "input_tokens": _pieces(tokenizer, ids),
                "input_length": len(ids),
                "last_token_embedding_first8": [round(float(x), 6) for x in weight[:8].tolist()],
                "last_position_embedding_first8": [round(float(x), 6) for x in absolute[:8].tolist()],
                "hidden_states": layers,
                "attention": {
                    "head": 0,
                    "first_layer": [round(float(x), 7) for x in head0.tolist()],
                    "last_layer": [round(float(x), 7) for x in headlast.tolist()],
                },
                "top_tokens": [
                    {
                        "id": int(token_id),
                        "text": tokenizer.decode([int(token_id)], clean_up_tokenization_spaces=False),
                        "probability": round(float(prob), 9),
                    }
                    for prob, token_id in zip(top.values.tolist(), top.indices.tolist())
                ],
                "chosen_token": {
                    "id": chosen,
                    "text": tokenizer.decode([chosen], clean_up_tokenization_spaces=False),
                },
            }
            steps.append(step)
            generated.append(chosen)
            ids.append(chosen)

    output = {
        "schema": "eai-real-trace-v1",
        "kind": "recorded_model_execution",
        "model": {
            "id": MODEL_ID,
            "revision": revision,
            "sha256_weights": checksum,
            "license": "mit",
            "architecture": "gpt_neo",
            "layers": int(model.config.num_layers),
            "heads": int(model.config.num_heads),
            "hidden_size": int(model.config.hidden_size),
            "experts": 0,
            "tokenizer": "model-specific GPT-Neo/GPT-2 tokenizer, not o200k_harmony",
            "url": SOURCE_URL,
        },
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "prompt": PROMPT,
        "prompt_tokens": _pieces(tokenizer, tokenizer.encode(PROMPT, add_special_tokens=False)),
        "generated_tokens": _pieces(tokenizer, generated),
        "completion": tokenizer.decode(generated, clean_up_tokenization_spaces=False),
        "steps": steps,
        "notes": [
            "Real CPU forward passes of a trained open GPT-Neo model, not gpt-oss.",
            "All attention, embedding, hidden and probability values are recorded from execution.",
            "No expert routing: this model does not use Mixture-of-Experts.",
            "Measurements only apply to the exact English prompt shown here.",
            "No visitor text is sent anywhere: this JSON was produced once, ahead of publication.",
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Created {out}: {len(output['steps'])} real inference steps, {out.stat().st_size} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="artifacts/tinystories-real-trace.json", type=Path)
    args = parser.parse_args()
    export(args.out)
