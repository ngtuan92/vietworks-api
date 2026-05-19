import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (token) => {
  try {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        providerId: payload.sub,
      };
    } catch (idTokenError) {
      client.setCredentials({ access_token: token });
      const userInfo = await client.request({
        url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      });

      const { email, name, picture, sub } = userInfo.data;
      if (!email) throw new Error('Could not retrieve email from Google');

      return {
        email,
        name,
        picture,
        providerId: sub,
      };
    }
  } catch (error) {
    throw new Error('Google token verification failed: ' + error.message);
  }
};
