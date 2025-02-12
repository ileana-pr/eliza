import type { Plugin } from "@elizaos/core";

export interface MemeTokenData {
    address: string;
    symbol: string;
    name: string;
    price: number;
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    holders: number;
    createdAt: Date;
    lastUpdated: Date;
    // Additional data for better token analysis
    holderDistribution: 'increasing' | 'decreasing' | 'stable';
    topHolderConcentration: number;
    isDexListed: boolean;
    liquidityUSD: number;
    uniqueWallets24h: number;
}

export interface TokenAlert {
    type: 'price_change' | 'volume_spike' | 'holder_increase' | 'new_token';
    token: MemeTokenData;
    message: string;
    severity: 'info' | 'warning' | 'alert';
    timestamp: Date;
}

export interface TrackingConfig {
    minMarketCap: number;
    minVolume24h: number;
    priceChangeThreshold: number;
    volumeSpikeThreshold: number;
    holderIncreaseThreshold: number;
    updateInterval: number;
}

export type { Plugin }; 