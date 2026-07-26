import axios from 'axios';

/**
 * Exchange LinkedIn Authorization Code for Access Token
 * and fetch user profile.
 */
export const verifyLinkedinCode = async (code, redirectUri) => {
  try {
    // 1. Exchange code for access token
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('client_id', process.env.LINKEDIN_CLIENT_ID);
    params.append('client_secret', process.env.LINKEDIN_CLIENT_SECRET);
    params.append('redirect_uri', redirectUri || process.env.LINKEDIN_REDIRECT_URI);

    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Fetch user profile using the access token (using OpenID Connect)
    const userResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const { email, name, given_name, family_name, picture, sub } = userResponse.data;

    return {
      email,
      name: name || `${given_name} ${family_name}`,
      picture,
      providerId: sub,
    };
  } catch (error) {
    console.error('LinkedIn Auth Error:', error.response?.data || error.message);
    throw new Error('Xác thực LinkedIn thất bại');
  }
};
