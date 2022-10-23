class JWT_token_manager {
    private jwt : any;
    private crypt : any;
    constructor () {
        this.crypt = require('crypto');
        this.jwt = require('jsonwebtoken');
    }
    public async accessTokenAsync (uniq_id : string, access_secret: string | Buffer, expires: string | number = 1800) : Promise<string> {
        console.log('uniq_id: ', uniq_id);
        let accessToken : string = this.jwt.sign({ID : uniq_id}, access_secret, {expiresIn : expires});
        /* console.log('Access secret ket: ', access_secret.toString('base64url'));
        console.log('Access token made by JWT module: ', accessToken);
        console.log('accessToken (jwt.sign) type of: ', typeof accessToken); */
        return 'Bearer ' + accessToken;
    }

    public async refreshTokenAsync (refresh_secret: string | Buffer) : Promise<string> {
        let refreshToken : string = this.jwt.sign({hm : 'skibidi vapa dub'}, refresh_secret);
        /* console.log('Refresh secret ket: ', refresh_secret.toString('base64url'));
        console.log('Refresh token made by JWT module: ', refreshToken);
        console.log('refreshToken (jwt.sign) type of: ', typeof refreshToken); */
        return 'Bearer ' + refreshToken;
    }

    public async tokenValidation (token : string, secret: string | Buffer) : Promise<boolean> {
        try{
            token = token.split(' ')[1];
            let payload = this.jwt.verify(token, secret);
            return true;
        } catch(err) {
            console.log('jwt_mngr : token invalid or error');
            return false;
        }
    }

    public async newSecret() : Promise<Buffer> {
        return this.crypt.randomBytes(32);
    }

    /* async newAccessTokenByRefresh(accessToken : string, refreshToken : string, access_secret: string | Buffer, refresh_secret: string | Buffer) : Promise<string | boolean> {
        try {
            accessToken = accessToken.split(' ')[1];
            refreshToken = refreshToken.split(' ')[1];
            let payload = this.jwt.verify(accessToken, access_secret, { ignoreExpiration : true });
            let newAccessToken : string = await this.accessTokenAsync(payload.ID, access_secret);
            let new_refresh_secret : Buffer = this.crypt.randomBytes(32);
            let newRefreshToken : string = await this.refreshTokenAsync (refresh_secret);
            let doneAccessToken : string = 'Bearer ' + newAccessToken;
            return doneAccessToken;
    
        } catch(err) {
            console.log('Hacker, please, go touch the grass outside');
            return false;
        }
    } */

}

module.exports = {
    JWT_token_manager
}