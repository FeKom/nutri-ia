import { r as require_token_util } from './chunk-OS7SAIRA.mjs';
import { _ as __commonJS, r as require_token_error } from './index.mjs';
import '@mastra/core/evals/scoreTraces';
import '@mastra/core/mastra';
import '@mastra/core/server';
import '@mastra/core/request-context';
import '@mastra/ai-sdk';
import 'ai';
import '@mastra/loggers';
import '@mastra/core/agent';
import 'fs';
import 'path';
import '@mastra/memory';
import '@mastra/libsql';
import './tools/3d04a4ce-010b-4dc7-bb02-751a43a5e32d.mjs';
import '@mastra/core/tools';
import 'zod';
import './user-profile-loader.mjs';
import './logger.mjs';
import 'node:async_hooks';
import 'pino';
import './catalog-client.mjs';
import './tools/5a10dbc9-cb8f-4071-bc7e-17514019cccf.mjs';
import './tools/88366530-06a7-4320-8478-cfd34ccd87a4.mjs';
import './tools/4df92f12-3a5f-4ab4-ba6a-c04a9d13923f.mjs';
import '@mastra/core/processors';
import './tools/0befe13e-3727-422d-93db-2af9a4a53328.mjs';
import './output.mjs';
import './tools/93cdda6b-fab7-409e-87a7-393b6b130d8a.mjs';
import './tools/88097629-cfd8-45ec-b0f4-2d22f1770dff.mjs';
import './tools/f56ff243-9043-45df-8a1b-bfec3a01568c.mjs';
import './tools/09d2f8b4-f7cc-4304-9bc4-3e749cef5ef9.mjs';
import './tools/f552fefd-93a8-4e04-937f-7cc89ed0a1b9.mjs';
import './tools/e88d3dd8-c11a-40f9-8d67-0b53d8aef5d9.mjs';
import './tools/16f92fd5-4969-4145-bd7c-0d192bc679f2.mjs';
import './tools/593c2792-7746-4aa5-b1b4-27a73c836763.mjs';
import './tools/5809d76f-09fc-4846-b952-8b968baabf91.mjs';
import './tools/11a061fe-bc81-43db-8ec3-5f24c1274e92.mjs';
import './tools/4114f54d-d1b5-43e9-a40c-1c871e5e5aab.mjs';
import './tools/1fb80dec-620e-43a8-89f4-82b08e84692d.mjs';
import 'jose';
import '@mastra/observability';
import 'better-auth';
import 'better-auth/plugins';
import 'crypto';
import 'pg';
import 'fs/promises';
import 'https';
import 'url';
import 'http';
import 'http2';
import 'stream';
import 'process';
import '@mastra/core/utils/zod-to-json';
import '@mastra/core/error';
import '@mastra/core/features';
import '@mastra/core/llm';
import '@mastra/core/utils';
import '@mastra/core/evals';
import '@mastra/core/storage';
import '@mastra/core/a2a';
import 'stream/web';
import 'zod/v3';
import 'zod/v4';
import '@mastra/core/memory';
import 'child_process';
import 'module';
import 'util';
import 'os';
import '@mastra/core/workflows';
import 'buffer';
import './tools.mjs';

// ../memory/dist/token-6GSAFR2W-ABXTQD64.js
var require_token = __commonJS({
  "../../../node_modules/.pnpm/@vercel+oidc@3.0.5/node_modules/@vercel/oidc/dist/token.js"(exports$1, module) {
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    var token_exports = {};
    __export(token_exports, {
      refreshToken: () => refreshToken
    });
    module.exports = __toCommonJS(token_exports);
    var import_token_error = require_token_error();
    var import_token_util = require_token_util();
    async function refreshToken() {
      const { projectId, teamId } = (0, import_token_util.findProjectInfo)();
      let maybeToken = (0, import_token_util.loadToken)(projectId);
      if (!maybeToken || (0, import_token_util.isExpired)((0, import_token_util.getTokenPayload)(maybeToken.token))) {
        const authToken = (0, import_token_util.getVercelCliToken)();
        if (!authToken) {
          throw new import_token_error.VercelOidcTokenError(
            "Failed to refresh OIDC token: login to vercel cli"
          );
        }
        if (!projectId) {
          throw new import_token_error.VercelOidcTokenError(
            "Failed to refresh OIDC token: project id not found"
          );
        }
        maybeToken = await (0, import_token_util.getVercelOidcToken)(authToken, projectId, teamId);
        if (!maybeToken) {
          throw new import_token_error.VercelOidcTokenError("Failed to refresh OIDC token");
        }
        (0, import_token_util.saveToken)(maybeToken, projectId);
      }
      process.env.VERCEL_OIDC_TOKEN = maybeToken.token;
      return;
    }
  }
});
var token6GSAFR2W = require_token();

export { token6GSAFR2W as default };
