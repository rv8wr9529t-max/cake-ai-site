import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import {
  getAllModels,
  getModelById,
  createModel,
  updateModel,
  deleteModel,
  createConversation,
  getConversationById,
  getConversationMessages,
  addMessage,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  models: router({
    list: publicProcedure.query(async () => {
      return getAllModels();
    }),
    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      return getModelById(input);
    }),
    create: publicProcedure
      .input(z.object({
        displayName: z.string(),
        modelName: z.string(),
        apiUrl: z.string(),
        apiKey: z.string(),
        status: z.enum(["active", "inactive"]).default("active"),
      }))
      .mutation(async ({ input }) => {
        return createModel(input);
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        displayName: z.string().optional(),
        modelName: z.string().optional(),
        apiUrl: z.string().optional(),
        apiKey: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateModel(id, data);
      }),
    delete: publicProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        return deleteModel(input);
      }),
  }),
  chat: router({
    createConversation: publicProcedure
      .input(z.object({
        modelId: z.number(),
        title: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createConversation({
          modelId: input.modelId,
          title: input.title,
        });
      }),
    getConversation: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const conversation = await getConversationById(input);
        if (!conversation) return null;
        const msgs = await getConversationMessages(input);
        return { ...conversation, messages: msgs };
      }),
    // Get conversation messages for real-time updates
    getMessages: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return getConversationMessages(input);
      }),
    sendMessage: publicProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const conversation = await getConversationById(input.conversationId);
        if (!conversation) throw new Error("Conversation not found");
        
        // Add user message
        await addMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.content,
        });
        
        // Get model info
        const model = await getModelById(conversation.modelId);
        if (!model) throw new Error("Model not found");
        
        // Get conversation history for context
        const messages = await getConversationMessages(input.conversationId);
        
        // Prepare messages for LLM
        const llmMessages = messages.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));
        
        // Call LLM API using model's API configuration
        try {
          let assistantContent: string;
          
          // Use custom model API from backend configuration
          if (!model.apiUrl || !model.apiKey) {
            throw new Error("Model API configuration is incomplete. Please configure apiUrl and apiKey in the admin panel.");
          }
          
          const customResponse = await fetch(model.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${model.apiKey}`,
            },
            body: JSON.stringify({
              messages: llmMessages,
              model: model.modelName,
            }),
          });
          
          if (!customResponse.ok) {
            throw new Error(`Model API error: ${customResponse.status} ${customResponse.statusText}`);
          }
          
          const customData = await customResponse.json();
          const customContent = customData.choices?.[0]?.message?.content;
          assistantContent = typeof customContent === "string" ? customContent : "Unable to generate response from model API";
          
          // Add assistant message to database
          await addMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: typeof assistantContent === "string" ? assistantContent : JSON.stringify(assistantContent),
          });
          
          return { 
            success: true, 
            modelId: model.id,
            response: assistantContent,
          };
        } catch (error) {
          console.error("LLM API error:", error);
          // Add error message to database
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await addMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: `Error: ${errorMessage}`,
          });
          throw new Error(`LLM API failed: ${errorMessage}`);
        }
      }),
  }),
  // Stream message endpoint for real-time updates
  stream: router({
    getConversationMessages: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        return getConversationMessages(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
