const {createClient} = require('redis');
const mongoose = require('mongoose');
const {promisify} = require('util');
const client = createClient();
const hgetAsync = promisify(client.hget).bind(client);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (key) {
  this._enableCache = true;
  this._cacheKey = key || '';
  return this;
}

mongoose.Query.prototype.exec = async function () {
  if(!this._enableCache){
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify({},this.getQuery(),{
    collection: this.mongooseCollection.name
  });
  const cachedValue = await hgetAsync(this._cacheKey,key);

  if(cachedValue) {
    const data = JSON.parse(cachedValue);
    return Array.isArray(data)? data.map(d=> new this.model(d)): new this.model(data);
  }

  const result = await exec.apply(this, arguments);
  client.hset(this._cacheKey,key, JSON.stringify(result));
  client.expire(this._cacheKey, 10);
  return result;
}

module.exports = {
  cleanCache(key){
    client.del(key)
  }
}
