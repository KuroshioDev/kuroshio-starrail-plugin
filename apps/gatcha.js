const moment = require( 'moment')
const plugin = require( '../../lib/plugins/plugin.js')
const { rulePrefix } = require( '../utils/common.js')
const runtimeRender = require( '../common/runtimeRender.js')
const GatchaData = require( '../utils/gatcha/index.js')
const setting = require( '../utils/setting.js')

class Gatcha extends plugin {
  constructor (e) {
    super({
      name: '星铁plug抽卡分析',
      dsc: '星铁plug抽卡分析',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: -114514,
      rule: [
        {
          reg: `^${rulePrefix}抽卡链接(绑定)?$`,
          fnc: 'bindAuthKey'
        },
        {
          reg: `^${rulePrefix}(角色|光锥|武器|常驻|新手)?(跃迁|抽卡)?(记录|分析)`,
          fnc: 'gatcha'
        },
        {
          reg: `^${rulePrefix}抽卡帮助$`,
          fnc: 'gatchahelp'
        },
        {
          reg: `^${rulePrefix}更新(抽卡|跃迁)(记录)?$`,
          fnc: 'updateGatcha'
        }
      ]
    })
  }

  get appconfig () {
    return setting.getConfig('gachaHelp')
  }

  async gatchahelp (e) {
    await e.reply(`抽卡链接获取教程：${this.appconfig.docs}`)
  }

  async bindAuthKey (e) {
    this.setContext('doBindAuthKey')
    /** 回复 */
    await this.reply('请发送抽卡链接', false, { at: true })
  }

  async doBindAuthKey () {
    try {
      let key = this.e.msg.trim()
      key = key.split('authkey=')[1].split('&')[0]
      let user = this.e.user_id
      await redis.set(`STAR_RAILWAY:AUTH_KEY:${user}`, key)
      /** 复读内容 */
      this.reply('绑定成功', false)
    } catch (error) {
      this.reply('抽卡链接错误，请检查链接重新绑定', false)
    }
    /** 结束上下文 */
    this.finish('doBindAuthKey')
  }

  async getAuthKey () {
    let user = this.e.user_id
    let ats = this.e.message.filter((m) => m.type === 'at')
    if (ats.length > 0 && !this.e.atBot) {
      user = ats[0].qq
    }
    const authKey = await redis.get(`STAR_RAILWAY:AUTH_KEY:${user}`)
    if (!authKey) {
      await this.e.reply(
        '未绑定抽卡链接，请点击链接查看说明\nhttps://mp.weixin.qq.com/s/FFHTor5DiG3W_rfQVs3KJQ\n发送[#星铁抽卡链接]绑定'
      )
      return false
    }
    return authKey
  }

  async updateGatcha (e) {

    let user = e.user_id
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }

    const uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    if (!uid) {
      return e.reply('未绑定uid，请发送#星铁绑定uid进行绑定')
    }

    try {
      const authKey = await this.getAuthKey()
      const date = moment()
      const lastTime = await redis.get(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`)

      if (lastTime && date.diff(moment(lastTime), 'h') < 1) {
        await e.reply(`[${uid}]近期已经更新过数据了，上次更新时间：${lastTime}，两次更新间隔请大于1小时`)
        return false
      }

      redis.set(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`, date.format('YYYY-MM-DD HH:mm:ss'))

      await e.reply(`正在获取[${uid}]的跃迁数据...`)
      const gatcha = new GatchaData(uid, authKey)
      await gatcha.updateData()
      const msg = this.makeForwardMsg('跃迁数据获取成功，你可以使用：', '#星铁跃迁分析\n#星铁角色分析\n#星铁光锥分析\n#星铁常驻分析', '查看具体的跃迁数据')
      await e.reply(msg)
    } catch (error) {
      console.log(error)
      redis.set(`STAR_RAILWAY:GATCHA_LASTTIME:${uid}`, '')
      await e.reply('抽卡链接已过期，请重新获取并绑定')
    }
  }

  async gatcha (e) {
    let user = e.user_id
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length > 0 && !e.atBot) {
      user = ats[0].qq
    }
    const uid = await redis.get(`STAR_RAILWAY:UID:${user}`)
    try {
      const typeName = e.msg.replace(/#|\*|＊|星铁|星轨|崩铁|星穹铁道|穹批|跃迁|抽卡|记录|分析/g, '')
      let type = 0
      switch (typeName) {
        case '角色': {
          type = 11
          break
        }
        case '武器':
        case '光锥': {
          type = 12
          break
        }
        case '常驻': {
          type = 1
          break
        }
        case '新手': {
          type = 2
          break
        }
        default: {
          // eslint-disable-next-line no-unused-vars
          type = 0
          break
        }
      }

      const gatcha = new GatchaData(uid, type === 2 ? await this.getAuthKey() : '')
      const stat = await gatcha.stat(type)
      console.log({
        ...stat,
        uid
      })
      await runtimeRender(e, '/gatcha/new.html', {
        ...stat,
        uid,
        type,
        filterRank: type === 0 ? 5 : 4
      })
    } catch (err) {
      logger.error(err)
      await e.reply('本地暂无抽卡记录，请发送#星铁更新跃迁，更新抽卡记录')
    }
  }

  /**
 * 制作转发消息
 * @param {string} title 标题 - 首条消息
 * @param {string} msg 日志信息
 * @param {string} end 最后一条信息
 * @returns
 */
  async makeForwardMsg (title, msg, end) {
    let nickname = (this.e.bot ?? Bot).nickname
    if (this.e.isGroup) {
      let info = await (this.e.bot ?? Bot).getGroupMemberInfo(this.e.group_id, (this.e.bot ?? Bot).uin)
      nickname = info.card || info.nickname
    }
    let userInfo = {
      user_id: (this.e.bot ?? Bot).uin,
      nickname
    }

    let forwardMsg = [
      {
        ...userInfo,
        message: title
      },
      {
        ...userInfo,
        message: msg
      }
    ]

    if (end) {
      forwardMsg.push({
        ...userInfo,
        message: end
      })
    }

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, '')
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)

    return forwardMsg
  }
}

module.exports = Gatcha
