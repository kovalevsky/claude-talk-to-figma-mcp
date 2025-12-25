import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrototypeTools } from '../../src/talk_to_figma_mcp/tools/prototype-tools';

jest.mock('../../src/talk_to_figma_mcp/utils/websocket', () => ({
  sendCommandToFigma: jest.fn()
}));

describe("prototype tools integration", () => {
  let server: McpServer;
  let mockSendCommand: jest.Mock;
  let toolHandlers: Map<string, Function> = new Map();
  let toolSchemas: Map<string, z.ZodObject<any>> = new Map();

  beforeEach(() => {
    server = new McpServer(
      { name: 'test-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    mockSendCommand = require('../../src/talk_to_figma_mcp/utils/websocket').sendCommandToFigma;
    mockSendCommand.mockClear();

    const originalTool = server.tool.bind(server);
    jest.spyOn(server, 'tool').mockImplementation((...args: any[]) => {
      if (args.length === 4) {
        const [name, description, schema, handler] = args;
        toolHandlers.set(name, handler);
        toolSchemas.set(name, z.object(schema));
      }
      return (originalTool as any)(...args);
    });

    registerPrototypeTools(server);
  });

  async function callTool(toolName: string, args: any) {
    const schema = toolSchemas.get(toolName);
    const handler = toolHandlers.get(toolName);
    if (!schema || !handler) {
      throw new Error(`Tool ${toolName} not found`);
    }
    const validatedArgs = schema.parse(args);
    const result = await handler(validatedArgs, { meta: {} });
    return result;
  }

  describe("add_prototype_interaction", () => {
    beforeEach(() => {
      mockSendCommand.mockResolvedValue({
        sourceName: "Button",
        destinationName: "NextScreen"
      });
    });

    it("adds a basic click interaction", async () => {
      const response = await callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012"
      });

      expect(mockSendCommand).toHaveBeenCalledTimes(1);
      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(command).toBe("add_prototype_interaction");
      expect(payload).toEqual({
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        trigger: "ON_CLICK",
        navigation: "NAVIGATE",
        transition: undefined,
        preserveScrollPosition: false
      });

      expect(response.content[0].text).toContain("ON_CLICK");
      expect(response.content[0].text).toContain("Button");
      expect(response.content[0].text).toContain("NextScreen");
    });

    it("adds hover interaction with overlay navigation", async () => {
      await callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        trigger: "ON_HOVER",
        navigation: "OVERLAY"
      });

      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(payload.trigger).toBe("ON_HOVER");
      expect(payload.navigation).toBe("OVERLAY");
    });

    it("adds interaction with transition settings", async () => {
      await callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        transition: {
          type: "SMART_ANIMATE",
          duration: 500,
          easing: "EASE_IN_AND_OUT"
        }
      });

      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(payload.transition).toEqual({
        type: "SMART_ANIMATE",
        duration: 500,
        easing: "EASE_IN_AND_OUT"
      });
    });

    it("adds interaction with slide transition and direction", async () => {
      await callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        transition: {
          type: "SLIDE_IN",
          duration: 300,
          direction: "LEFT"
        }
      });

      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(payload.transition.type).toBe("SLIDE_IN");
      expect(payload.transition.direction).toBe("LEFT");
    });

    it("preserves scroll position when specified", async () => {
      await callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        preserveScrollPosition: true
      });

      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(payload.preserveScrollPosition).toBe(true);
    });

    it("handles all trigger types", async () => {
      const triggers = ["ON_CLICK", "ON_HOVER", "ON_PRESS", "ON_DRAG"] as const;

      for (const trigger of triggers) {
        mockSendCommand.mockClear();
        await callTool("add_prototype_interaction", {
          sourceNodeId: "123:456",
          destinationNodeId: "789:012",
          trigger
        });

        const [command, payload] = mockSendCommand.mock.calls[0];
        expect(payload.trigger).toBe(trigger);
      }
    });

    it("handles all navigation types", async () => {
      const navigations = ["NAVIGATE", "OVERLAY", "SWAP", "SCROLL_TO", "CHANGE_TO"] as const;

      for (const navigation of navigations) {
        mockSendCommand.mockClear();
        await callTool("add_prototype_interaction", {
          sourceNodeId: "123:456",
          destinationNodeId: "789:012",
          navigation
        });

        const [command, payload] = mockSendCommand.mock.calls[0];
        expect(payload.navigation).toBe(navigation);
      }
    });

    it("rejects missing sourceNodeId", async () => {
      await expect(callTool("add_prototype_interaction", {
        destinationNodeId: "789:012"
      })).rejects.toThrow();

      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("rejects missing destinationNodeId", async () => {
      await expect(callTool("add_prototype_interaction", {
        sourceNodeId: "123:456"
      })).rejects.toThrow();

      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("rejects invalid trigger type", async () => {
      await expect(callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        trigger: "INVALID_TRIGGER"
      })).rejects.toThrow();

      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("rejects invalid navigation type", async () => {
      await expect(callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012",
        navigation: "INVALID_NAV"
      })).rejects.toThrow();

      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("handles error from Figma", async () => {
      mockSendCommand.mockRejectedValue(new Error("Node not found"));

      const response = await callTool("add_prototype_interaction", {
        sourceNodeId: "123:456",
        destinationNodeId: "789:012"
      });

      expect(response.content[0].text).toContain("Error");
      expect(response.content[0].text).toContain("Node not found");
    });
  });

  describe("remove_prototype_interactions", () => {
    beforeEach(() => {
      mockSendCommand.mockResolvedValue({
        name: "Button",
        removedCount: 3
      });
    });

    it("removes all interactions from a node", async () => {
      const response = await callTool("remove_prototype_interactions", {
        nodeId: "123:456"
      });

      expect(mockSendCommand).toHaveBeenCalledTimes(1);
      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(command).toBe("remove_prototype_interactions");
      expect(payload).toEqual({ nodeId: "123:456" });

      expect(response.content[0].text).toContain("3");
      expect(response.content[0].text).toContain("Button");
    });

    it("rejects missing nodeId", async () => {
      await expect(callTool("remove_prototype_interactions", {})).rejects.toThrow();
      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("handles error from Figma", async () => {
      mockSendCommand.mockRejectedValue(new Error("Node does not support interactions"));

      const response = await callTool("remove_prototype_interactions", {
        nodeId: "123:456"
      });

      expect(response.content[0].text).toContain("Error");
    });
  });

  describe("get_prototype_interactions", () => {
    beforeEach(() => {
      mockSendCommand.mockResolvedValue({
        name: "Button",
        reactions: [
          {
            trigger: { type: "ON_CLICK" },
            action: {
              type: "NODE",
              destinationId: "789:012",
              navigation: "NAVIGATE"
            }
          }
        ]
      });
    });

    it("gets all interactions from a node", async () => {
      const response = await callTool("get_prototype_interactions", {
        nodeId: "123:456"
      });

      expect(mockSendCommand).toHaveBeenCalledTimes(1);
      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(command).toBe("get_prototype_interactions");
      expect(payload).toEqual({ nodeId: "123:456" });

      const resultText = response.content[0].text;
      expect(resultText).toContain("Button");
      expect(resultText).toContain("reactions");
    });

    it("rejects missing nodeId", async () => {
      await expect(callTool("get_prototype_interactions", {})).rejects.toThrow();
      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("handles empty reactions", async () => {
      mockSendCommand.mockResolvedValue({
        name: "EmptyNode",
        reactions: []
      });

      const response = await callTool("get_prototype_interactions", {
        nodeId: "123:456"
      });

      const resultText = response.content[0].text;
      expect(resultText).toContain("EmptyNode");
    });

    it("handles error from Figma", async () => {
      mockSendCommand.mockRejectedValue(new Error("Node not found"));

      const response = await callTool("get_prototype_interactions", {
        nodeId: "123:456"
      });

      expect(response.content[0].text).toContain("Error");
    });
  });

  describe("set_starting_frame", () => {
    beforeEach(() => {
      mockSendCommand.mockResolvedValue({
        name: "HomeScreen"
      });
    });

    it("sets a frame as starting point", async () => {
      const response = await callTool("set_starting_frame", {
        nodeId: "123:456"
      });

      expect(mockSendCommand).toHaveBeenCalledTimes(1);
      const [command, payload] = mockSendCommand.mock.calls[0];
      expect(command).toBe("set_starting_frame");
      expect(payload).toEqual({ nodeId: "123:456" });

      expect(response.content[0].text).toContain("HomeScreen");
      expect(response.content[0].text).toContain("starting frame");
    });

    it("rejects missing nodeId", async () => {
      await expect(callTool("set_starting_frame", {})).rejects.toThrow();
      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("handles error when node is not a frame", async () => {
      mockSendCommand.mockRejectedValue(new Error("Node must be a FRAME"));

      const response = await callTool("set_starting_frame", {
        nodeId: "123:456"
      });

      expect(response.content[0].text).toContain("Error");
      expect(response.content[0].text).toContain("FRAME");
    });
  });
});
