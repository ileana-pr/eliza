import { Plugin } from "@ai16z/eliza";
import {currentNewsAction } from "./actions/news.ts";
import { randomEmotionProvider } from "./providers/time.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const devschoolPlugin: Plugin = {
    name: "devschool",
    description: "Devschool plugin",
    actions: [currentNewsAction],
    evaluators: [],
    providers: [randomEmotionProvider],
};