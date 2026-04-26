/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'https://geezos-api-a0gcdncwefdchgf3.eastus2-01.azurewebsites.net',
  },
}
module.exports = nextConfig
