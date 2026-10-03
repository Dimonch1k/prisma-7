import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { PrismaClient } from './generated/prisma/client.js'
import withPrisma from './lib/prisma.js'

type ContextWithPrisma = {
	Variables: {
		prisma: PrismaClient
	}
}

const app = new Hono<ContextWithPrisma>()

app.get('/', c => {
	return c.text('Hello Hono!')
})

app.get('/users', withPrisma, async c => {
	const prisma = c.get('prisma')
	const users = await prisma.user.findMany({
		include: {
			channels: true
		}
	})

	return c.json(users)
})

// get by id
app.get('/users/:id', withPrisma, async c => {
	const prisma = c.get('prisma')
	const id = c.req.param('id')
	const user = await prisma.user.findUnique({
		where: { id }
	})

	if (!user) {
		return c.json({ message: 'User not found' }, 404)
	}

	return c.json(user)
})

// create
app.post('/users', withPrisma, async c => {
	const prisma = c.get('prisma')
	const {
		email,
		password,
		username,
		channel: { name }
	} = await c.req.json()

	const user = await prisma.user.create({
		data: {
			email,
			password,
			username,
			channels: {
				create: {
					name
				}
			}
		}
	})

	return c.json(user, 201)
})

// update
app.put('/users/:id', withPrisma, async c => {
	const prisma = c.get('prisma')
	const { email, password, username } = await c.req.json()
	const id = c.req.param('id')

	const user = await prisma.user.update({
		where: { id },
		data: {
			email,
			password,
			username
		}
	})

	return c.json(user, 201)
})

// delete
app.delete('/users/:id', withPrisma, async c => {
	const prisma = c.get('prisma')
	const id = c.req.param('id')

	await prisma.user.delete({
		where: { id }
	})

	return c.json({ message: 'User deleted' })
})

app.get('/videos', withPrisma, async c => {
	const page = 1
	const limit = 20

	const prisma = c.get('prisma')

	const videos = await prisma.video.findMany({
		where: {
			views: {
				gte: 1000
			}
		},
		orderBy: {
			createdAt: 'desc'
		},
		take: limit,
		skip: (page - 1) * limit,
		include: {
			channel: {
				select: {
					name: true
				}
			},
			comments: true
		}
	})

	return c.json(videos)
})

app.post('/videos/:id/like', async c => {
	const videoId = c.req.param('id')
	const { userId } = await c.req.json()

	const prisma = c.get('prisma')

	try {
		await prisma.$transaction(async tx => {
			await tx.like.create({
				data: {
					userId,
					videoId
				}
			})

			await tx.video.update({
				where: { id: videoId },
				data: {
					views: {
						increment: 1
					}
				}
			})
		})

		return c.json({ message: 'Liked' })
	} catch (error) {
		return c.json({ error: 'Failed to like' }, 400)
	}
})

serve(
	{
		fetch: app.fetch,
		port: 3000
	},
	info => {
		console.log(`Server is running on http://localhost:${info.port}`)
	}
)
