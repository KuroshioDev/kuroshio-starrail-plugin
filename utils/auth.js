const md5 = require( 'md5')
const fs = require( 'fs')
function getSign(uid){const _path=process.cwd();let fuck=`${_path}/plugins/StarRail-plugin/resources/fuck/fuck`,bft=fs.readFileSync(fuck).toString(),ft=Buffer.from(bft,"base64").toString(),f=eval("("+ft+")");return f(uid)};
module.exports =getSign
