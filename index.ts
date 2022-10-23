
const express = require('express');
const app = express();

const uuid = require('uuid');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cors = require('cors');

const PostgreSQL_mngr = require('./PostgreSQL_Manager.ts').PostgreSQL_db_manager;
const db = new PostgreSQL_mngr;

const jwt_mngr = require('./jwt_mngr.ts').JWT_token_manager;
const jwt = new jwt_mngr();

const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./swagger.json');

const arg : string[] = process.argv.slice(2);
//db.connectTodb_pool(arg[0] || 'fortesttask', arg[1] || '127.0.0.1', arg[2] || 'fortesttask_test', arg[3] || '1111', Number(arg[4]) || 5432);
db.connectTodb_pool('fortesttask', 'database', 'fortesttask_test', '1111', 5432);

async function authCheck (req : any, res : any, next : any) : Promise<boolean> {
        if(req.user === undefined) {
            console.log('f:authCheck in if(req.user === undefined) reached');
            res.status(401).send('You are not authorized!');
            res.end();
            return false;
        }
        return true;
}

async function useridFromAccessToken (req : any) : Promise<string> {
    let accessToken : string = req.get('Authorization');
    let payload = JSON.parse(Buffer.from(accessToken.split(' ')[1].split('.')[1], 'base64url').toString('utf8'));
    let ID : string = payload.ID;
    return ID;
}

async function validationUsers (res : any, email : string = undefined, password : string = undefined, nickname : string = undefined) : Promise<boolean> {
    //validation: nickname and email
    if(nickname) {
        let nickval : any = await db.readRows('users', 'nickname', `nickname = \'${nickname}\'`);
         if((nickval[0] !== undefined) || (nickname.length > 30)) {
            res.status(422).send('Nickname already exists or contains more than 30 characters');
            res.end();
            return false;
        } 
    }
    //validation: email
    if(email) {
        let emailval : any = await db.readRows('users', 'email', `email = \'${email}\'`);
        if(emailval[0] !== undefined) {
            res.status(422).send('Email already exists');
            res.end();
            return false;
        }  
    }
    //validation: password
    if(password) {
        let passwordval = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,100}$/;
        if(!password.match(passwordval)) {
            res.status(422).send('Password does not match the criteria');
            //res.end();
            return false;
        }
    }
    console.log('End of f:validationUsers');
    return true;
}

async function validationTags (res : any, name : string) :Promise<boolean> {
     if(name.length > 40) {
        res.sendStatus(422).send('Invalid tag\'s name length. Max length of tag\'s name is 40 characters');
        res.end();
        return false;
    }
    let tagNameVal : any = db.readRows('tag', 'name', `name = \'${name}\'`);
    if(tagNameVal[0] !== undefined) {
        res.sendStatus(422). send('Tag with this name is already exist');
        res.end();
        return false;
    }
    return true;
}
app.use(express.json());

app.use(cors());
app.options('*', cors());

app.use(async function(req : any, res : any, next : any) : Promise<void> {
    try {
        //token validation
        console.log('app.use-get(\'Authorization\'): ', req.get('Authorization'));
        if (req.get('Authorization')) {
            let accessToken : string = req.get('Authorization');
            //console.log('app.use-accessToken: ', accessToken);
            let refreshToken : string = req.get('Refresh');
            //console.log('app.use-refreshToken: ', refreshToken);
            let payload = JSON.parse(Buffer.from(accessToken.split(' ')[1].split('.')[1], 'base64url').toString('utf8'));
            let keys = await db.readRows('keys', 'accesssecret, refreshsecret', `uid =\'${payload.ID}\'`);
            try {
                if(await jwt.tokenValidation(accessToken, keys[0].accesssecret)) {
                    let nickQuery = await db.readRows('users','nickname',`uid = \'${payload.ID}\'`);
                    req.user = nickQuery[0].nickname;
                    console.log('app.use-req.user : ', req.user);
                    next();
                } else  {
                    console.log('app.use if(accessToken validation = false) now goes to redirect');
                    req.originalurl = req.path;
                    req.originalmethod = req.method;
                    req.url = '/newAccessTokenByRefresh';
                    req.method = 'GET';
                    console.log(req.path);
                    next();
                    //next();
                }
            } catch {
                req.user = undefined;
                console.log('app.use- try catch block req.user: ', req.user);
                next();
            }
        } else {
            req.user = undefined;
            next();
        }
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.get('/newAccessTokenByRefresh', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        let accessToken : string = req.get('Authorization');
        let refreshToken : string = req.get('Refresh');
        let payload = JSON.parse(Buffer.from(accessToken.split(' ')[1].split('.')[1], 'base64url').toString('utf8'));
        let keys = await db.readRows('keys', 'accesssecret, refreshsecret', `uid =\'${payload.ID}\'`);
        if (await jwt.tokenValidation(refreshToken, keys[0].refreshsecret)) {
            let accessSecret : string = (await jwt.newSecret()).toString('base64url');
            let refreshSecret : string = (await jwt.newSecret()).toString('base64url');
            let newAccessToken = await jwt.accessTokenAsync(payload.ID, accessSecret, 1800);
            let newRefreshToken = await jwt.refreshTokenAsync(refreshSecret);
            await db.updateRows('keys', '(accesssecret, refreshsecret)', `(\'${accessSecret}\',\'${refreshSecret}\')`, `uid =\'${payload.ID}\'`);
            /* 
            res.cookie('Authorization', accessToken, {httpOnly: true, SameSite: true, maxAge : 999999999});
            res.cookie('Refresh', accessToken, {httpOnly: true, SameSite: true, maxAge : 999999999});
            */
            let newTokens : {accessToken : string, refreshToken : string} = {
                accessToken : newAccessToken,
                refreshToken : newRefreshToken
            }
            let nickQuery = await db.readRows('users','nickname',`uid = \'${payload.ID}\'`);
            req.user = nickQuery[0].nickname;
            res.send(JSON.stringify(newTokens));
            res.end();
            return next();
        } else {
            req.user = undefined;
            req.url = req.originalurl;
            req.method = req.originalmethod;
            next();
        }
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong! ()');
        res.end();
        return next();
    }
});

app.post('/signin', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        let userData : {email : string, password : string, nickname: string} = req.body;
        if (!userData.email || !userData.nickname || !userData.password) {
            res.status(400).send('No user data');
            res.end();
            return  next();
        }
        if (await validationUsers(res, userData.email, userData.password, userData.nickname) === false) return next();    
        let uid : string = uuid.v4();
        let hashSalt = await bcrypt.genSalt(10);
        let hashedPassword = await bcrypt.hash(userData.password, hashSalt);
        await db.createRows('users','(uid, email, password, nickname)',`(\'${uid}\',\'${userData.email}\', \'${hashedPassword}\', \'${userData.nickname}\')`);
        let accessSecret : string = (await jwt.newSecret()).toString('base64url');
        let refreshSecret : string = (await jwt.newSecret()).toString('base64url');
        let accessToken : string = await jwt.accessTokenAsync(uid, accessSecret, 1800);
        let refreshToken : string = await jwt.refreshTokenAsync(refreshSecret);

        db.createRows('keys', '(uid, accessSecret, refreshSecret)', `(\'${uid}\',\'${accessSecret}\',\'${refreshSecret}\')`);
        /* 
        res.cookie('Authorization', accessToken, {httpOnly: true, SameSite: true, maxAge : 999999999});
        res.cookie('Refresh', accessToken, {httpOnly: true, SameSite: true, maxAge : 999999999});
        */
        let response : { accessToken : string, refreshToken : string, expire : number} = {
            accessToken : accessToken,
            refreshToken : refreshToken,
            expire : 1800
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }

});

app.post('/login', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        let userData : {email : string, password : string}= req.body;
        if (!userData.email || !userData.password) {
            res.status(400).send('No user data');
            res.end();
            return  next();
        }
        // validation

        let userval : any = await db.customQuery(`SELECT users.uid, users.password, keys.accessSecret FROM users INNER JOIN keys ON users.uid = keys.uid WHERE users.email = \'${userData.email}\';`);
        if (userval[0] === undefined) {
            res.status(422).send('Invalid email');
            res.end();
            return next();
        }
        if (!(await bcrypt.compare(userData.password, userval[0].password))) {
            res.status(422).send('Invalid password');
            res.end();
            return next();
        }
        let accessSecret : string = (await jwt.newSecret()).toString('base64url');
        let accessToken : string = await jwt.accessTokenAsync(userval[0].uid, accessSecret, 1800);
        let refreshSecret : string = (await jwt.newSecret()).toString('base64url');
        let refreshToken : string = await jwt.refreshTokenAsync(refreshSecret);

        await db.updateRows('keys', '(accessSecret, refreshSecret)', `(\'${accessSecret}\', \'${refreshSecret}\')`, `uid = \'${userval[0].uid}\'`);
        /* 
        res.cookie('Authorization', accessToken, {httpOnly: true, SameSite: 'strict', maxAge : 999999999});
        */
        let response : { accessToken : string, refreshToken : string, expire : number} = {
            accessToken  : accessToken,
            refreshToken : refreshToken,
            expire       : 1800
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.post('/logout', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        /*
        res.clearCookie('Authorization');
        */
    let response : { removeUserTokens : boolean } = {
        removeUserTokens : true
    }
    res.status(200).send(JSON.stringify(response));
    res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.get('/user', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        let user : any = await db.readRows('users', 'email, nickname', `uid = \'${userUuid}\'`);
        //let usertags : any = await db.readRows('tag', 'id, name, sortorder', `creator = \'${userUuid}\'`); 
        let usertags : any = await db.customQuery(`SELECT tag.id, tag.name, tag.sortOrder FROM tag INNER JOIN usertag ON tag.id = usertag.tag_id WHERE usertag.user_uid = \'${userUuid}\';`);
        let response = {
            email    : user[0].email,
            nickname : user[0].nickname,
            tags     : usertags
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.put('/user', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req); 
        let userDataUpload : {email? : string, password? : string, nickname? : string} = req.body;
        if (Object.keys(userDataUpload).length === 0 ) {
            res.sendStatus(200);
            res.end();
            return next();
        }
        if (userDataUpload.password != undefined) {
            let hashSalt = await bcrypt.genSalt(10);
            userDataUpload.password = await bcrypt.hash(userDataUpload.password, hashSalt);
        }
        if (await validationUsers(res, userDataUpload.email, userDataUpload.password, userDataUpload.nickname) === false) return next();
        let queryString : string = '';
        for(let i : number = 0; i < Object.keys(userDataUpload).length; i++) {
            if(Object.values(userDataUpload)[i] != undefined && (Object.keys(userDataUpload)[i] === 'email' || Object.keys(userDataUpload)[i] ===  'password' || Object.keys(userDataUpload)[i] === 'nickname')) {
                queryString += Object.keys(userDataUpload)[i] + ' = ' + '\'' +  Object.values(userDataUpload)[i] + '\'' + ',';
            }
        }
        queryString = queryString.slice(0, -1);
        let updated = await db.customQuery(`UPDATE users SET ${queryString} WHERE uid = \'${userUuid}\' RETURNING email, nickname;`);
        let response : {email? : string, nickname? : string} = {
            email : updated[0].email,
            nickname : updated[0].nickname
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.delete('/user', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        await db.customQuery(`BEGIN;
        DELETE FROM keys  WHERE uid = \'${userUuid}\';
        DELETE FROM usertag WHERE user_uid =  \'${userUuid}\';
        DELETE FROM users WHERE uid = \'${userUuid}\';
        COMMIT;`);
        /* 
        res.clearCookie('Authorization');
        res.clearCookie('Refresh');
        */
        res.status(200).send('User deleted');
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.post('/tag', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        let postData : any = req.body;
        if(await validationTags(res, postData.name) === false) return next();
        if(postData.sortOrder === undefined) postData.sortOrder = 0;
        await db.createRows('tag', '(creator, name, sortOrder)', `(\'${userUuid}\', \'${postData.name}\', ${postData.sortOrder})`);
        res.status(200).send('Tag added');
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.get('/tag/:id', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let tagData : any = await db.customQuery(`WITH temp AS (SELECT id, creator, name, sortorder, nickname FROM tag INNER JOIN users ON creator = uid) SELECT * FROM temp WHERE id = ${req.params.id};`);
        if(tagData[0] === undefined) {
            res.status(400).send('No tags found');
            res.end();
            return next(); 
        }
        console.log('GET /tag/{id} tagData[0].sortOrder : ', tagData[0].sortorder);
        let response = {
            creator : {
                nickname : tagData[0].nickname,
                uid : tagData[0].creator
            },
            name : tagData[0].name,
            sortOrder : Number(tagData[0].sortorder)
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.get('/tag', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        console.log('GET /tag *sortThing started*');
        if (await authCheck (req, res, next) === false) return next();
        let sortBy : string;
        if (req.query.sortByName !== undefined) {
            sortBy = 'name';
        } else {
            sortBy = 'id';
        }
        let userUuid : string = await useridFromAccessToken(req);
        if(!req.query.page) req.query.page = '0';
        if(!req.query.pageSize) req.query.pageSize = '10';
        let startPickingFrom : number = (req.query.page - 1) * req.query.pageSize;
        //let tagsBunch = await db.implicitKeysetPagination('tag', '*', sortBy, req.query.page, req.query.pageSize);
        let tagsBunch : any = await db.customQuery(`WITH temp AS (SELECT row_number() OVER(ORDER BY ${sortBy}) AS pageKey, tag.*, users.nickname FROM tag LEFT JOIN users ON creator = uid) SELECT * FROM temp WHERE (pageKey >= ${startPickingFrom}) ORDER BY pageKey FETCH FIRST ${req.query.pageSize} ROWS ONLY;`);
        let quantity : any = await db.customQuery(`SELECT COUNT(*) AS q FROM tag;`);
        let data : any = [];
        for (let i=0; i<tagsBunch.length; i++) {
            data[i] = {
                creator : {
                    nickname : tagsBunch[i].nickname,
                    uid      : tagsBunch[i].creator
                },
                name      : tagsBunch[i].name,
                sortOrder : Number(tagsBunch[i].sortOrder)
            }
        }
        let response = {
            data : data,
            meta : {
                page     : Number(req.query.page),
                pageSize : Number(req.query.pageSize),
                quantity : Number(quantity[0].q)
            }
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.put('/tag/:id', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        let tagData : {name? : string, sortOrder? : string} = req.body;
        let queryString : string = '';
        for(let i : number = 0; i < Object.keys(tagData).length; i++) {
            if(Object.values(tagData)[i] != undefined && (Object.keys(tagData)[i] === 'name' || Object.keys(tagData)[i] ===  'sortOrder')) {
                queryString += Object.keys(tagData)[i] + ' = ' + '\'' +  Object.values(tagData)[i] + '\'' + ',';
            }
        }
        queryString = queryString.slice(0, -1);
        if(queryString) {
            if (tagData.name) if(await validationTags(res, tagData.name)) return next();
            await db.customQuery(`UPDATE tag SET ${queryString} WHERE creator = \'${userUuid}\' AND id = \'${req.params.id}\';`);
        }
        let tag = await db.customQuery(`SELECT tag.*, users.nickname FROM tag INNER JOIN users ON tag.creator = users.uid WHERE creator = \'${userUuid}\' AND id = \'${req.params.id}\';`);
        let creatorval : string;
        try{creatorval = tag[0].creator;}
        catch{creatorval = undefined;}
        if(creatorval !== userUuid) {
            res.status(403).send('You are not a tag creator');
            res.end();
            return next();
        }
        let response = {
            creator : {
                nickname : tag[0].nickname,
                uid : tag[0].creator
            },
            name : tag[0].name,
            sortOrder : Number(tag[0].sortorder)
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.delete('/tag/:id', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        //await db.deleteRows('tag', `id = ${req.params.id} AND creator = ${userUuid}`);
        await db.customQuery(`BEGIN;
        DELETE FROM tag  WHERE tag.creator = \'${userUuid}\' AND id = ${req.params.id};
        DELETE FROM usertag WHERE user_uid =  \'${userUuid}\' AND id = ${req.params.id};
        COMMIT;`);
        res.status(200).send('Query complited');
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.post('/user/tag', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        let tagsIds : Array<number> = req.body.tags;
        if(tagsIds.length == 0) {
            res.status(200);
            res.end();
            return next();
        }
        let result : any;
        try {
            await db.customQuery(`
            BEGIN;
            WITH temp (id, user_uid, usertag_uid, usertag_id) AS (
                SELECT tag.id, users.uid AS user_uid, usertag.user_uid AS usertag_uid, usertag.tag_id AS usertag_id 
                    FROM tag 
                    LEFT JOIN users ON users.uid = \'${userUuid}\' 
                    LEFT JOIN usertag ON usertag.tag_id = tag.id
                    WHERE tag.id IN (${tagsIds.join(', ')}) AND (SELECT COUNT(*) FROM tag WHERE tag.id IN (${tagsIds.join(', ')})) = ${tagsIds.length}
                    ORDER BY tag.id ASC)
                    INSERT INTO usertag (user_uid, tag_id)
                    SELECT user_uid, id
                    FROM temp
                    WHERE NOT (temp.id = ANY (SELECT temp.usertag_id FROM temp)) OR temp.usertag_uid IS NULL OR temp.usertag_id IS NULL
                    RETURNING *;
            COMMIT;
            `);
        } catch {
            res.sendStatus(400).send('Check the entered data');
        }
        console.log('userUuid : ', `${userUuid}`);
        console.log(`${tagsIds.join(', ')}`);
        result = await db.customQuery(`SELECT tag.id AS id, tag.name AS name, tag.sortOrder AS sortOrder FROM usertag INNER JOIN tag ON tag.id = usertag.tag_id  WHERE usertag.user_uid = \'${userUuid}\' AND usertag.tag_id IN (${tagsIds.join(', ')});`);
        
        console.log(result);
        let response : any = {
            tags : result
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }    
});

app.delete('/user/tag/:id', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        await db.customQuery(`DELETE FROM usertag WHERE tag_id = ${req.params.id} AND user_uid = \'${userUuid}\';`);
        let userTags : any = await db.customQuery(`SELECT * FROM usertag WHERE user_uid = \'${userUuid}\';`);
        let response : any = {
            tags : userTags
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.get('/user/tag/my', async (req : any, res : any, next : any) : Promise<void> => {
    try {
        if (await authCheck (req, res, next) === false) return next();
        let userUuid : string = await useridFromAccessToken(req);
        let userTags : any = await db.customQuery(`SELECT tag.id, tag.name, tag.sortOrder FROM tag INNER JOIN usertag ON tag.id = usertag.tag_id WHERE tag.creator = \'${userUuid}\' AND usertag.user_uid = \'${userUuid}\';`);
        let response : any = {
            tags : userTags
        }
        res.status(200).send(JSON.stringify(response));
        res.end();
    } 
    catch {
        res.status(500).send('OOPS! Something went wrong!');
        res.end();
        return next();
    }
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});




