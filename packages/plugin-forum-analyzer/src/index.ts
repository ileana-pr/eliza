import type { Plugin } from "@elizaos/core";
import { latestTopicsAction } from "./actions/latestTopics";
import { searchTopicsAction } from "./actions/searchTopics";

export { latestTopicsAction, searchTopicsAction };

export const forumAnalyzerPlugin: Plugin = {
    name: "forum-analyzer",
    description: "Plugin for analyzing and summarizing forum discussions",
    actions: [latestTopicsAction, searchTopicsAction],
    evaluators: []
};

export default forumAnalyzerPlugin; 