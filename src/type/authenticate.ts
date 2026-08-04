import { z } from 'zod';
import { serviceUserProfileSchema } from './user';

export const authenticateSchema = z.object({
    type: z.literal('authenticateServer'),
    address: z.string(),
    time: z.number(),
    userProfile: serviceUserProfileSchema,
})