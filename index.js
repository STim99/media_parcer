import { gotScraping } from "got-scraping";
import { resolve } from "path";

import normalizeUrl from "normalize-url";
import Fastify from "fastify";

import formBodyPlugin from "fastify-formbody";
import fastifyStatic from "fastify-static";
import pov from "point-of-view";
import fastifyCors from "fastify-cors";
import ejs from "ejs";

const fastify = Fastify({ logger: true, pluginTimeout: 2000 });
const PORT = process.env.PORT ?? 3000;

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

fastify.post("/", async (request, reply) => {
  request.log.info(request.body);
  gotScraping({
    url: request.body.url,
    headerGeneratorOptions: {
      browsers: [
        {
          name: "chrome",
          minVersion: 87,
        },
        {
          name: "firefox",
          minVersion: 80,
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
      const media = response.body.match(/\[(2|3).+mp4/gi)?.[0];
      if (media) {
        media.split(/,| or /).forEach((link) => {
          if (/^http/i.test(link)) {
            url.push(normalizeUrl(new URL(link).href));
          }
        });
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
