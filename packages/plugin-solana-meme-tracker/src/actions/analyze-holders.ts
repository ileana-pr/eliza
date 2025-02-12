import type { Action } from "@elizaos/core";
import { BirdeyeProvider } from "@elizaos/plugin-birdeye/src/birdeye";
import type { MemeTokenData } from "../types";

export interface HolderAnalysis {
    totalHolders: number;
    longTermHolders: number; // Holding > 2 months
    longTermHoldingPercent: number;
    averageHoldingTime: number; // in days
}

export const analyzeHoldersAction: Action = {
    name: "analyze-holders",
    description: "Analyze token holders and their holding duration",
    parameters: {
        type: "object",
        required: ["tokenAddress"],
        properties: {
            tokenAddress: {
                type: "string",
                description: "The address of the token to analyze"
            },
            minHoldingPeriod: {
                type: "number",
                description: "Minimum holding period in days to be considered a long-term holder",
                default: 60 // 2 months
            }
        }
    },
    execute: async (context, { tokenAddress, minHoldingPeriod = 60 }) => {
        try {
            const provider = new BirdeyeProvider(context.cacheManager);
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

            // Get holder data
            const holderData = await provider.fetchTokenHolders({
                address: tokenAddress,
                offset: 0,
                limit: 100 // Start with top 100 holders
            });

            if (!holderData.success) {
                throw new Error(`Failed to fetch holder data: ${holderData.message || 'Unknown error'}`);
            }

            // Get historical transactions to analyze holding duration
            const txData = await provider.fetchDefiTradesTokenSeekByTime({
                address: tokenAddress,
                before_time: Math.floor(Date.now() / 1000),
                after_time: Math.floor(twoMonthsAgo.getTime() / 1000)
            });

            // Create a map of holder addresses and their first transaction time
            const holderFirstTx = new Map<string, number>();
            
            txData.data.items.forEach(tx => {
                const holderAddress = tx.owner;
                if (!holderFirstTx.has(holderAddress) || tx.blockTime < holderFirstTx.get(holderAddress)!) {
                    holderFirstTx.set(holderAddress, tx.blockTime);
                }
            });

            // Analyze holders
            let longTermHolders = 0;
            let totalHoldingTime = 0;
            const now = Math.floor(Date.now() / 1000);

            holderData.data.items.forEach(holder => {
                const firstTxTime = holderFirstTx.get(holder.owner);
                if (firstTxTime) {
                    const holdingTime = (now - firstTxTime) / (24 * 60 * 60); // Convert to days
                    totalHoldingTime += holdingTime;
                    if (holdingTime >= minHoldingPeriod) {
                        longTermHolders++;
                    }
                }
            });

            const analysis: HolderAnalysis = {
                totalHolders: holderData.data.items.length,
                longTermHolders,
                longTermHoldingPercent: (longTermHolders / holderData.data.items.length) * 100,
                averageHoldingTime: totalHoldingTime / holderData.data.items.length
            };

            context.logger.info(`Holder Analysis for token ${tokenAddress}:`);
            context.logger.info(`Total Holders: ${analysis.totalHolders}`);
            context.logger.info(`Long Term Holders (>${minHoldingPeriod} days): ${analysis.longTermHolders}`);
            context.logger.info(`Long Term Holding %: ${analysis.longTermHoldingPercent.toFixed(2)}%`);
            context.logger.info(`Average Holding Time: ${analysis.averageHoldingTime.toFixed(2)} days`);

            return {
                success: true,
                data: analysis
            };
        } catch (error) {
            context.logger.error("Error analyzing holders:", error);
            throw error;
        }
    }
}; 