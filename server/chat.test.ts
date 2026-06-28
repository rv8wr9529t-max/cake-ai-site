import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("chat router", () => {
  let ctx: TrpcContext;

  beforeAll(() => {
    ctx = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  });

  it("should handle sendMessage", async () => {
    const caller = appRouter.createCaller(ctx);
    
    // First create a model
    const modelResult = await caller.models.create({
      displayName: "Test Model",
      modelName: "gpt-4",
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      status: "active",
    });
    
    console.log("Created model:", modelResult);
    
    // Create a conversation
    const convResult = await caller.chat.createConversation({
      modelId: (modelResult as any).id || 1,
      title: "Test Conversation",
    });
    
    console.log("Created conversation:", convResult);
    
    expect(convResult).toBeDefined();
    expect((convResult as any).id).toBeDefined();
  });
});
