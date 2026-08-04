import { z } from 'zod';

const serviceUserIdSchema = z.string().brand<'ServiceUserId'>()

export const serviceUserProfileSchema = z.object({
  id: serviceUserIdSchema,
  handle: z.string(),
  name: z.string(),
  avatarType: z.string(),
  avatarForegroundType: z.string(),
  avatarForegroundColor: z.string(),
  avatarBackgroundType: z.string(),
  avatarBackgroundColor: z.string(),
  bannerType: z.string(),
  aboutMe: z.string(),
  favorites: z.array(z.string()), 
})