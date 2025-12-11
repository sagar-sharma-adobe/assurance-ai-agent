/**
 * State Schema for Chat Workflow
 * Defines what data flows through the LangGraph workflow
 */

import { Annotation } from "@langchain/langgraph";

/**
 * Define the state schema using LangGraph Annotation
 * This defines the shape of data that flows through the graph
 */
export const GraphState = Annotation.Root({
  // === INPUT ===
  sessionId: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  
  userMessage: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  
  // === CONTEXT ===
  rawEvents: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  
  rawDocs: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  
  conversationHistory: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  
  // === ANALYSIS ===
  intent: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  
  formattedEventContext: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  
  formattedKnowledgeContext: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  
  errorEvents: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  
  // === OUTPUT ===
  response: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  
  metadata: Annotation({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  
  // === INTERNAL ===
  tokensUsed: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
});

export default GraphState;

