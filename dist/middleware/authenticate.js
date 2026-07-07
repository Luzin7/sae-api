export async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
        const payload = request.user;
        request.playerId = payload.sub;
        request.playerName = payload.name;
    }
    catch {
        reply.status(401).send({ message: 'Unauthorized' });
    }
}
//# sourceMappingURL=authenticate.js.map