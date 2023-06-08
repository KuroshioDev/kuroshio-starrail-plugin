const MysApi = require( '../../genshin/model/mys/mysApi.js')
const md5 = require( 'md5')
const _ = require( 'lodash')
const DEVICE_ID = randomString(32).toUpperCase()
const DEVICE_NAME = randomString(_.random(1, 10))
const {Logger} = require('koishi')
const common = require("../../lib/common/common.js");
const logger = new Logger('starrail-plugin-note')
class MysSRApi extends MysApi {
  constructor (uid, cookie, option = {}) {
    super(uid, cookie, option)
    this.uid = uid
    this.server = 'prod_gf_cn'
    // this.server = 'hkrpg_cn'
  }

  getUrl (type, data = {}) {
    let host, hostRecord, hostPublicData
    if (['prod_gf_cn'].includes(this.server)) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
      hostPublicData = 'https://public-data-api.mihoyo.com/'
    } else {
      host = 'https://api-os-takumi.mihoyo.com/'
      hostRecord = 'https://bbs-api-os.mihoyo.com/'
    }
    let urlMap = {
      srCharacterDetail: {
        url: `${hostRecord}game_record/app/hkrpg/api/avatar/info`,
        query: `need_wiki=true&role_id=${this.uid}&server=${this.server}`
      },
      srUser: {
        url: `${host}binding/api/getUserGameRolesByCookie`,
        query: 'game_biz=hkrpg_cn'
      },
      srCharacter: {
        url: `${hostRecord}game_record/app/hkrpg/api/avatar/basic`,
        query: `rolePageAccessNotAllowed=&role_id=${this.uid}&server=${this.server}`
      },
      srNote: {
        url: `${hostRecord}game_record/app/hkrpg/api/note`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      srCard: {
        url: `${hostRecord}game_record/app/hkrpg/api/index`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      srMonth: {
        url: `${host}event/srledger/month_info`,
        query: `uid=${this.uid}&region=${this.server}&month=`
      },
      srPayAuthKey: {
        url: `${host}binding/api/genAuthKey`,
        body: {
          auth_appid: 'csc',
          game_biz: 'hkrpg_cn',
          game_uid: this.uid * 1,
          region: 'prod_gf_cn'
        }
      },
      getFp: {
        url: `${hostPublicData}device-fp/api/getFp`,
        body: {
          seed_id: `${generateSeed(16)}`,
          device_id: this.deviceId,
          platform: '5',
          seed_time: new Date().getTime() + '',
          ext_fields: '{"userAgent":"Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/2.50.1","browserScreenSize":281520,"maxTouchPoints":5,"isTouchSupported":true,"browserLanguage":"zh-CN","browserPlat":"iPhone","browserTimeZone":"Asia/Shanghai","webGlRender":"Apple GPU","webGlVendor":"Apple Inc.","numOfPlugins":0,"listOfPlugins":"unknown","screenRatio":3,"deviceMemory":"unknown","hardwareConcurrency":"4","cpuClass":"unknown","ifNotTrack":"unknown","ifAdBlock":0,"hasLiedResolution":1,"hasLiedOs":0,"hasLiedBrowser":0}',
          app_name: 'account_cn',
          device_fp: '38d7ee834d1e9'
        },
        noDs: true
      }
    }
    if (!urlMap[type]) return false
    let { url, query = '', body = '', noDs = '' } = urlMap[type]
    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body)
    if (data.deviceFp) {
      headers['x-rpc-device_fp'] = data.deviceFp
    }
    if (typeof this.cookie == 'string') {
      headers.cookie = this.cookie
    } else {
      let cookie = this.cookie[Object.keys(this.cookie).filter(k => this.cookie[k].ck)[0]]
      headers.cookie = cookie?.ck
      this.deviceId = cookie?.device_id
    }
    if (this.deviceId) {
      headers['x-rpc-device_id'] = this.deviceId
    }
    if (type === 'srPayAuthKey') {
      headers.DS = this.getDS2()
      let extra = {
        'x-rpc-app_version': '2.40.1',
        'User-Agent': 'okhttp/4.8.0',
        'x-rpc-client_type': '5',
        Referer: 'https://app.mihoyo.com',
        Origin: 'https://webstatic.mihoyo.com',
        // Cookie: this.cookies,
        DS: this.getDS2(),
        'x-rpc-sys_version': '12',
        'x-rpc-channel': 'mihoyo',
        'x-rpc-device_id': DEVICE_ID,
        'x-rpc-device_name': DEVICE_NAME,
        'x-rpc-device_model': 'Mi 10',
        Host: 'api-takumi.mihoyo.com'
      }
      headers = Object.assign(headers, extra)
    } else {
      headers.DS = this.getDs(query, body)
    }
    if (noDs) {
      delete headers.DS
      if (this.deviceId) {
        body = JSON.parse(body)
        body.device_id = this.deviceId
        body = JSON.stringify(body)
      }
    }
    return { url, headers, body }
  }

  getDs (q = '', b = '') {
    let n = ''
    if (['prod_gf_cn'].includes(this.server)) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(this.server)) {
      n = 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getDS2 () {
    let t = Math.round(new Date().getTime() / 1000)
    let r = randomString(6)
    let sign = md5(`salt=jEpJb9rRARU2rXDA9qYbZ3selxkuct9a&t=${t}&r=${r}`)
    return `${t},${r},${sign}`
  }

  getHeaders (query = '', body = '') {
    const cn = {
      app_version: '2.50.1',
      User_Agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/2.50.1',
      client_type: 5,
      Origin: 'https://webstatic.mihoyo.com',
      X_Requested_With: 'com.mihoyo.hyperion',
      Referer: 'https://webstatic.mihoyo.com'
    }
    const os = {
      app_version: '2.9.0',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBSOversea/2.9.0`,
      client_type: '2',
      Origin: 'https://webstatic-sea.hoyolab.com',
      X_Requested_With: 'com.mihoyo.hoyolab',
      Referer: 'https://webstatic-sea.hoyolab.com'
    }
    let client
    if (this.server.startsWith('os')) {
      client = os
    } else {
      client = cn
    }
    return {
      'x-rpc-app_version': client.app_version,
      'x-rpc-client_type': client.client_type,
      'x-rpc-page': '3.1.3_#/rpg',
      'User-Agent': client.User_Agent,
      Referer: client.Referer,
      DS: this.getDs(query, body)
    }
  }

  /**
   * 校验状态码
   * @param e 消息e
   * @param res 请求返回
   * @param callbackUrl url
   * @returns {Promise<*|boolean>}
   */
  async checkCode (e, res, callbackUrl) {
    if (!res || !e) {
      this.e.reply('米游社接口请求失败，暂时无法查询')
      return false
    }
    this.e = e
    res.retcode = Number(res.retcode)
    switch (res.retcode) {
      case 0:
        break
      case 1034:
        logger.info(`[米游社sr查询失败][uid:${this.uid}]遇到验证码`)
        res = await this.geetest(callbackUrl, true)
        break
      default:
        if (/(登录|login)/i.test(res.message)) {
          logger.info(`[ck失效][uid:${this.uid}]`)
          this.e.reply(`UID:${this.uid}，米游社cookie已失效`)
        } else {
          this.e.reply(`米游社接口报错，暂时无法查询：${res.message || 'error'}`)
        }
        break
    }
    if (res.retcode !== 0) {
      logger.info(`[米游社sr接口报错]${JSON.stringify(res)}，uid：${this.uid}`)
    }
    return res
  }
  async geetest(type, isSr) {
    let mysApi = new MysApi(this.uid, this.ckInfo.ck, { log: true }, isSr);
    let res;
    let validate
    try {
      res = await mysApi.getData('createVerification');
      let gt = res?.data?.gt;
      let challenge = res?.data?.challenge;
      res = await mysApi.getData('geetype', {
        gt
      });
      await common.sleep(300)
      this.e.reply('米游社接口遇见验证码，请等待Bot通过验证码~')
      res = await mysApi.getData('validate', {
        gt,
        challenge
      });
      if (!res) {
        await this.e.reply('接口请求失败~')
        return false
      }
      challenge = res.data.challenge
      validate = res.data.validate
      gt = res.data.gt
      res = await mysApi.getData('verifyVerification', {
        gt,
        challenge,
        validate
      });
      challenge = res?.data?.challenge //重新读取
      if (challenge) {
        res = await mysApi.getData(type, {
          "x-rpc-challenge": challenge
        })
        if (res.retcode == 1034) {
          await this.e.reply('米游社接口遇见验证码，请上米游社通过验证码')
        }
      }
    } catch (error) {
      logger.log(error)
      logger.error('无感日志：' + error)
      return false
    }
    return res
  }
}

function randomString (length) {
  let randomStr = ''
  for (let i = 0; i < length; i++) {
    randomStr += _.sample('abcdefghijklmnopqrstuvwxyz0123456789')
  }
  return randomStr
}



function generateSeed (length = 16) {
  const characters = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters[Math.floor(Math.random() * characters.length)]
  }
  return result
}



module.exports = MysSRApi
module.generateSeed = generateSeed
