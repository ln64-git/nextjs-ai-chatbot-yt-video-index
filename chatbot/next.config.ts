import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	experimental: {
		ppr: true,
	},
	images: {
		remotePatterns: [
			{
				hostname: "avatar.vercel.sh",
			},
		],
	},
	webpack: (config, { isServer }) => {
		// Exclude ONNX runtime and transformers from client bundle
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				path: false,
				os: false,
				crypto: false,
				stream: false,
				util: false,
			};

			// Exclude specific modules from client bundle
			config.externals = config.externals || [];
			config.externals.push({
				"@xenova/transformers": "commonjs @xenova/transformers",
				"onnxruntime-node": "commonjs onnxruntime-node",
			});
		}

		return config;
	},
};

export default nextConfig;
