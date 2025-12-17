/**
 * Main Chat Workflow using LangGraph
 * Orchestrates the entire conversation flow
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphState } from "./state.js";

// Import nodes
import { classifyIntent } from "./nodes/intentClassifier.js";
import { retrieveContexts } from "./nodes/contextRetriever.js";
import { formatContexts } from "./nodes/contextFormatter.js";
import { generateResponse } from "./nodes/responseGenerator.js";

/**
 * Create the chat workflow graph
 */
export function createChatWorkflow() {
  // Initialize graph with state schema
  const workflow = new StateGraph(GraphState);

  // Add nodes
  workflow.addNode("classifyIntent", classifyIntent);
  workflow.addNode("retrieveContexts", retrieveContexts);
  workflow.addNode("formatContexts", formatContexts);
  workflow.addNode("generateResponse", generateResponse);

  // Define edges (flow control)
  workflow.addEdge(START, "classifyIntent"); // Entry point
  workflow.addEdge("classifyIntent", "retrieveContexts");
  workflow.addEdge("retrieveContexts", "formatContexts");
  workflow.addEdge("formatContexts", "generateResponse");
  workflow.addEdge("generateResponse", END);

  // Compile the graph
  return workflow.compile();
}

// Export singleton instance
export const chatWorkflow = createChatWorkflow();

export default chatWorkflow;

