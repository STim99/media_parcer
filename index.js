import { Buffer } from "buffer";
import { gotScraping } from "got-scraping";
import { resolve } from "path";

import normalizeUrl from "normalize-url";
import Fastify from "fastify";

import formBodyPlugin from "fastify-formbody";
import fastifyStatic from "fastify-static";
import pov from "point-of-view";
import fastifyCors from "fastify-cors";
import ejs from "ejs";

const fastify = Fastify({ logger: true });
const PORT = process.env.PORT ?? 3000;

function decode(b) {
  function c(a) {
    return Buffer.from(a.toString("base64"));
  }
  function d(a) {
    return decodeURIComponent(
      Buffer.from(a, "base64")
        .toString("binary")
        .split("")
        .map(function (a) {
          return "%" + ("00" + a.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
  }
  const e = {
    bk0: "$$#!!@#!@##",
    bk1: "^^^!@##!!##",
    bk2: "####^!!##!@@",
    bk3: "@@@@@!##!^^^",
    bk4: "$$!!@$$@^!@#$$@",
    file3_separator: "//_//",
  };
  let f = b.substr(2);
  for (let a = 4; -1 < a; a--) {
    f = f.replace(e.file3_separator + c(e["bk" + a]), "");
  }
  try {
    f = d(f);
  } catch (a) {
    f = "";
  }
  return f;
}

fastify.register(formBodyPlugin);
fastify.register(fastifyStatic, {
  root: resolve("./public"),
  prefix: "/public/",
});
fastify.register(fastifyCors, {
  origin: "*",
  methods: ["POST"],
});

fastify.register(pov, {
  engine: {
    ejs: ejs,
  },
});

fastify.get("/", async (request, reply) => {
  return reply.sendFile("index.min.html");
});

fastify.post("/api", async (request, reply) => {
  request.log.info(request.body);
  gotScraping({
    url: request.body.url,
    headers: {
      referer: "https://rezka.ag/",
    },
    headerGeneratorOptions: {
      browsers: [
        {
          name: "chrome",
          minVersion: 90,
        },
        {
          name: "firefox",
          minVersion: 85,
        },
      ],
      devices: ["desktop", "mobile"],
      locales: ["ru-RU", "en-US"],
      operatingSystems: ["windows", "android"],
    },
  })
    .then((response) => {
      request.log.info({ statusCode: response.statusCode, url: response.url });
      request.log.info({ body: response.body });
      const url = [];
      const findHash = response.body
        .match(/"streams":"#[a-zA-Z0-9\\/_=]*"/gi)?.[0]
        .replace(/\\/g, "")
        .split('"')?.[3];
      const media = decode(findHash);
      if (media) {
        const links = media.split(/,| or /);
        for (const link of links) {
          if (/^http/i.test(link)) {
            url.push(normalizeUrl(new URL(link).href));
          }
        }
        return reply.view("/templates/index.min.ejs", { url });
      } else {
        return reply.status(500).send("Media is not found");
      }
    })
    .catch(function (e) {
      request.log.error(e);
      return reply.status(500).send(e);
    });
});

const start = async () => {
  try {
    await fastify.listen(PORT, "0.0.0.0");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
