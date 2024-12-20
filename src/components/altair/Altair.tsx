/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import { calendarService } from '../../services/calendarService';

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

const calendarDeclaration: FunctionDeclaration = {
  name: "manage_calendar",
  description: "Manages calendar events and queries for the user.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: "The calendar-related query or command from the user",
      },
      context: {
        type: SchemaType.STRING,
        description: "Optional context of the conversation",
      },
    },
    required: ["query"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: `You are JARVIS, Avijit's personal AI assistant. You specialize in managing his calendar and time efficiently. When handling calendar-related queries:
1. Always maintain conversation context to provide more natural responses
2. For meeting-related questions, use previous context to give more relevant answers
3. For scheduling, remember Avijit's preferences from previous interactions
4. If a query seems unrelated to previous context, treat it as a new conversation
5. The tool calls sometime returns technical terms of jargons. Use easy language to respond or explain to users.
6. You must not confirm of a task until you have completed the task using appripriate tools and functions. This gives a false sense of accomplishment.

Use the manage_calendar function for all calendar operations, passing both the query and relevant context to maintain conversation flow.`,
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [calendarDeclaration] },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      
      for (const fc of toolCall.functionCalls) {
        if (fc.name === declaration.name) {
          const str = (fc.args as any).json_graph;
          setJSONString(str);
        } else if (fc.name === "manage_calendar") {
          const { query, context = '' } = fc.args as any;
          try {
            const response = await calendarService.handleCalendarQuery(query, context);
            client.sendToolResponse({
              functionResponses: [{
                response: { output: response },
                id: fc.id,
              }],
            });
            continue;
          } catch (error) {
            console.error('Calendar API error:', error);
            client.sendToolResponse({
              functionResponses: [{
                response: { error: 'Failed to process calendar request' },
                id: fc.id,
              }],
            });
            continue;
          }
        }
      }

      // Handle any remaining function calls
      const remainingCalls = toolCall.functionCalls.filter(
        fc => fc.name !== "manage_calendar"
      );
      if (remainingCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: remainingCalls.map((fc) => ({
                response: { output: { success: true } },
                id: fc.id,
              })),
            }),
          200,
        );
      }
    };
    
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);
  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);
