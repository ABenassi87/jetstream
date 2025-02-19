import { User } from '.prisma/client';
import { ENV, logger } from '@jetstream/api-config';
import axios, { AxiosError } from 'axios';

export async function sendWelcomeEmail(user: User) {
  try {
    await axios.request({
      baseURL: ENV.JETSTREAM_WORKER_URL,
      url: '/job',
      method: 'POST',
      data: {
        type: 'EMAIL',
        payload: {
          type: 'WELCOME',
          userId: user.userId,
          email: user.email,
        },
      },
    });
  } catch (ex) {
    if (ex.isAxiosError) {
      if (ex.response) {
        const errorResponse = (ex as AxiosError).response;
        logger.error('[WORKER-SERVICE][WELCOME EMAIL][ERROR] %s %o', errorResponse.status, errorResponse.data);
      } else {
        logger.error('[WORKER-SERVICE][WELCOME EMAIL][ERROR] Unknown error occurred', ex.message);
      }
    }
  }
}
