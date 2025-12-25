import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../utils/websocket";

/**
 * Register prototype tools to the MCP server
 * This module contains tools for managing prototype interactions in Figma
 * @param server - The MCP server instance
 */
export function registerPrototypeTools(server: McpServer): void {
  // Add Prototype Interaction Tool
  server.tool(
    "add_prototype_interaction",
    "Add a prototype interaction (reaction) to a node in Figma. Creates a click/hover interaction that navigates to a destination frame.",
    {
      sourceNodeId: z.string().describe("The ID of the source node (the element that will be clickable)"),
      destinationNodeId: z.string().describe("The ID of the destination frame to navigate to"),
      trigger: z.enum(["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG"]).optional().default("ON_CLICK").describe("The trigger type for the interaction"),
      navigation: z.enum(["NAVIGATE", "OVERLAY", "SWAP", "SCROLL_TO", "CHANGE_TO"]).optional().default("NAVIGATE").describe("The navigation type"),
      transition: z.object({
        type: z.enum(["DISSOLVE", "SMART_ANIMATE", "MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"]).optional(),
        duration: z.number().min(0).max(10000).optional().describe("Transition duration in milliseconds"),
        easing: z.enum(["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT", "EASE_IN_BACK", "EASE_OUT_BACK", "EASE_IN_AND_OUT_BACK"]).optional(),
        direction: z.enum(["LEFT", "RIGHT", "TOP", "BOTTOM"]).optional()
      }).optional().describe("Transition animation settings"),
      preserveScrollPosition: z.boolean().optional().default(false).describe("Whether to preserve scroll position when navigating")
    },
    async ({ sourceNodeId, destinationNodeId, trigger, navigation, transition, preserveScrollPosition }) => {
      try {
        const result = await sendCommandToFigma("add_prototype_interaction", {
          sourceNodeId,
          destinationNodeId,
          trigger,
          navigation,
          transition,
          preserveScrollPosition
        });
        const typedResult = result as { sourceName: string; destinationName: string };
        return {
          content: [
            {
              type: "text",
              text: `Added ${trigger} interaction from "${typedResult.sourceName}" to "${typedResult.destinationName}" with ${navigation} navigation`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding prototype interaction: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Remove Prototype Interactions Tool
  server.tool(
    "remove_prototype_interactions",
    "Remove all prototype interactions (reactions) from a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to remove interactions from"),
    },
    async ({ nodeId }) => {
      try {
        const result = await sendCommandToFigma("remove_prototype_interactions", { nodeId });
        const typedResult = result as { name: string; removedCount: number };
        return {
          content: [
            {
              type: "text",
              text: `Removed ${typedResult.removedCount} interaction(s) from node "${typedResult.name}"`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error removing prototype interactions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Get Prototype Interactions Tool
  server.tool(
    "get_prototype_interactions",
    "Get all prototype interactions (reactions) from a node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to get interactions from"),
    },
    async ({ nodeId }) => {
      try {
        const result = await sendCommandToFigma("get_prototype_interactions", { nodeId });
        const typedResult = result as { name: string; reactions: any[] };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                nodeName: typedResult.name,
                reactions: typedResult.reactions
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting prototype interactions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Set Starting Frame Tool
  server.tool(
    "set_starting_frame",
    "Set a frame as the starting point for prototype presentation",
    {
      nodeId: z.string().describe("The ID of the frame to set as starting point"),
    },
    async ({ nodeId }) => {
      try {
        const result = await sendCommandToFigma("set_starting_frame", { nodeId });
        const typedResult = result as { name: string };
        return {
          content: [
            {
              type: "text",
              text: `Set "${typedResult.name}" as the starting frame for prototype`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting starting frame: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
