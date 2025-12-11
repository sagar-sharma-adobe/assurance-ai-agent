/**
 * Event Formatter for LLM Context
 * Intelligently formats Assurance events to maximize relevance per token
 */

import { estimateTokens, truncateToTokenLimit } from './tokenManager.js';

/**
 * Extract critical fields from Assurance event payload
 */
function extractCriticalFields(payload) {
  if (!payload) return {};
  
  // Assurance-specific critical fields
  const critical = {};
  
  // ACP Extension fields (always important)
  if (payload.ACPExtensionEventType) critical.eventType = payload.ACPExtensionEventType;
  if (payload.ACPExtensionEventSource) critical.eventSource = payload.ACPExtensionEventSource;
  if (payload.ACPExtensionEventName) critical.eventName = payload.ACPExtensionEventName;
  
  // Event data (summarized if large)
  if (payload.ACPExtensionEventData) {
    const dataStr = JSON.stringify(payload.ACPExtensionEventData, null, 2);
    if (dataStr.length > 500) {
      critical.eventData = '[Large object - ' + Object.keys(payload.ACPExtensionEventData).length + ' fields]';
      // Include first-level keys for visibility
      critical.eventDataKeys = Object.keys(payload.ACPExtensionEventData);
    } else {
      critical.eventData = payload.ACPExtensionEventData;
    }
  }
  
  return critical;
}

/**
 * Format single event from search results for LLM context with token budget
 */
export function formatEventForContext(eventDoc, maxTokens = 300) {
  // eventDoc is from vector store: { pageContent: string, metadata: object }
  const { pageContent, metadata } = eventDoc;
  
  // If pageContent is already well-formatted and within budget, use it
  const currentTokens = estimateTokens(pageContent);
  
  if (currentTokens <= maxTokens) {
    return pageContent;
  }
  
  // Otherwise, truncate intelligently
  return truncateToTokenLimit(pageContent, maxTokens);
}

/**
 * Format multiple events with total token budget
 * Returns as many events as fit within budget, prioritized by relevance
 */
export function formatEventsForContext(eventDocs, maxTotalTokens = 3000) {
  if (!eventDocs || eventDocs.length === 0) {
    return {
      formatted: "",
      eventsIncluded: 0,
      totalTokens: 0,
    };
  }
  
  const formattedEvents = [];
  let totalTokens = 0;
  const tokensPerEvent = Math.floor(maxTotalTokens / eventDocs.length);
  
  for (const eventDoc of eventDocs) {
    const formatted = formatEventForContext(eventDoc, tokensPerEvent);
    const eventTokens = estimateTokens(formatted);
    
    // Check if adding this event exceeds budget
    if (totalTokens + eventTokens > maxTotalTokens) {
      console.log(`   📊 Token budget exhausted: included ${formattedEvents.length}/${eventDocs.length} events`);
      break;
    }
    
    formattedEvents.push(formatted);
    totalTokens += eventTokens;
  }
  
  return {
    formatted: formattedEvents.join('\n\n---\n\n'),
    eventsIncluded: formattedEvents.length,
    totalTokens: totalTokens,
  };
}

export default {
  formatEventForContext,
  formatEventsForContext,
};

