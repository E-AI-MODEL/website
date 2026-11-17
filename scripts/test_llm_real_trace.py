#!/usr/bin/env python3
"""Audit a genuine, recorded model trace without downloading any model."""
import argparse
import json
import math
import sys
from pathlib import Path


def check(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["schema"] == "eai-real-trace-v1"
    assert data["kind"] == "recorded_model_execution"
    model = data["model"]
    assert model["id"] == "EphAsad/IllaryiaStories-1M"
    assert model["license"] == "mit"
    assert model["architecture"] == "gpt_neo"
    assert model["experts"] == 0, "Do not suggest an expert router in dense GPT-Neo"
    assert model["revision"] and len(model["revision"]) >= 30
    assert len(model["sha256_weights"]) == 64
    assert len(data["prompt_tokens"]) > 0
    assert len(data["steps"]) == 4
    prefix = [t["id"] for t in data["prompt_tokens"]]
    for n, step in enumerate(data["steps"]):
        assert step["index"] == n
        assert [t["id"] for t in step["input_tokens"]] == prefix
        assert step["input_length"] == len(prefix)
        assert len(step["last_token_embedding_first8"]) == 8
        assert len(step["last_position_embedding_first8"]) == 8
        assert len(step["hidden_states"]) == model["layers"] + 1
        for layer_idx, layer in enumerate(step["hidden_states"]):
            assert layer["index"] == layer_idx
            assert layer["norm"] > 0 and math.isfinite(layer["norm"])
            assert len(layer["first"]) == 8
            assert all(math.isfinite(x) for x in layer["first"])
        for key in ("first_layer", "last_layer"):
            weights = step["attention"][key]
            assert len(weights) == len(prefix), "One attention weight per input position"
            assert all(math.isfinite(w) and w >= 0 for w in weights)
            assert abs(sum(weights) - 1) < 2e-4, f"Measured weights must sum to 1: {key}"
        top = step["top_tokens"]
        assert len(top) == 8
        assert top[0]["id"] == step["chosen_token"]["id"]
        assert top[0]["text"] == step["chosen_token"]["text"]
        assert all(0 < item["probability"] < 1 for item in top)
        assert all(top[i]["probability"] >= top[i+1]["probability"] for i in range(7))
        assert sum(item["probability"] for item in top) <= 1.00001
        prefix.append(step["chosen_token"]["id"])
    assert prefix[-4:] == [t["id"] for t in data["generated_tokens"]]
    assert data["completion"]
    print(f"PASS: {model['id']} real trace with {len(data['steps'])} steps and {model['layers']} layers")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    args = parser.parse_args()
    try:
        check(args.trace)
    except Exception as exc:
        print(f"INVALID model trace: {exc}", file=sys.stderr)
        raise
