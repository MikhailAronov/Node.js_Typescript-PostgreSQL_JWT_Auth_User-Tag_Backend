CREATE TABLE users (
  uid UUID PRIMARY KEY,
  email VARCHAR(100),
  password VARCHAR(100),
  nickname VARCHAR(30)  
);

CREATE TABLE keys (
  id SERIAL PRIMARY KEY,
  uid UUID,
  accessSecret VARCHAR(50),
  refreshSecret VARCHAR(50),
  CONSTRAINT fk_uid_users
    FOREIGN KEY (uid)
      REFERENCES users(uid)
);

CREATE TABLE tag (
  id SERIAL PRIMARY KEY,
  creator UUID,
  name VARCHAR(40),
  sortOrder INT DEFAULT 0,
  CONSTRAINT fk_tag_users
    FOREIGN KEY (creator)
        REFERENCES users(uid)
);

CREATE TABLE usertag (
    id SERIAL PRIMARY KEY,
  user_uid UUID,
  tag_id INT,
  CONSTRAINT fk_useruid_uid
    FOREIGN KEY (user_uid)
      REFERENCES users(uid),
  CONSTRAINT fk_tagid_id
    FOREIGN KEY (tag_id)
      REFERENCES tag(id)
);

