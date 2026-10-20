/** @type {import('next').NextConfig} */

if (process.env.NODE_ENV === "production") {
  if (!process.env.COOKIE_SECRET) {
    throw new Error("[SU-STORE] COOKIE_SECRET ต้องตั้งค่าใน production เพื่อป้องกัน cookie forgery");
  }
  if (process.env.COOKIE_SECRET.length < 32) {
    throw new Error("[SU-STORE] COOKIE_SECRET ต้องมีความยาวอย่างน้อย 32 ตัวอักษร");
  }
}

const orderApiHost = process.env.ORDER_API_BASE_URL
  ? new URL(process.env.ORDER_API_BASE_URL).hostname
  : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Order pages carry ?token= in the URL; never send it to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // Legacy FP28 orders remain available on the storefront that owns them.
      {
        source: "/check-order/fp28",
        destination: "https://fp28.sumfu.store/check-order/fp28",
        permanent: true,
      },
      {
        source: "/th/check-order/fp28",
        destination: "https://fp28.sumfu.store/check-order/fp28",
        permanent: true,
      },
      // Old FP28 links searched /check-order by student ID or FP28 order id; the query
      // string is carried over to the destination.
      ...["/check-order", "/th/check-order"].flatMap((source) =>
        ["studentCode", "orderId"].map((key) => ({
          source,
          has: [{ type: "query", key }],
          destination: "https://fp28.sumfu.store/check-order/fp28",
          permanent: true,
        }))
      ),
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: orderApiHost
      ? [
          {
            protocol: "http",
            hostname: orderApiHost,
            pathname: "/product-images/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
