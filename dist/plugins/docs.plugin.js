import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
export default fp(async (app) => {
    await app.register(swagger, {
        openapi: {
            openapi: '3.1.0',
            info: {
                title: 'Sangue e Aço API',
                description: 'REST API for the Sangue e Aço RPG platform',
                version: '1.0.0',
            },
            components: {
                securitySchemes: {
                    cookieAuth: {
                        type: 'apiKey',
                        in: 'cookie',
                        name: 'token',
                    },
                },
            },
        },
    });
});
//# sourceMappingURL=docs.plugin.js.map