/**
 * Created by Jarvis on 6/12/17.
 */

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

// TODO: Refactor config for FileMaker Data API & MongoDB
const axios = require('axios')
const Monk = require('monk')
const config = require('../config')

const db = Monk('localhost/fmstoken')
const tokens = db.get('tokens')

/**
 * @description 获取有效 FMS Data API Token
 *
 * @returns token 字串类型的 Token
 */
async function getToken () {
  // Searching
  const searchToken = async function () {
    try {
      const doc = await tokens.find({}, '-_id -time')
      const token = doc[doc.length - 1].token || ''

      await db.close()

      return token
    } catch (err) {
      console.error('FMS Token:  No records')
    }
  }

  /**
   * @description 创建 FMS Data API Token
   *
   * @returns {Promise.<*|CancelToken|string>}
   */
  const createToken = async function () {
    try {
      const queryUrl = `${config.fmsUrl}auth/${config.solution}`
      const queryData = {'user': config.username, 'password': config.password, 'layout': config.authLayout}
      const data = await axios.create().post(queryUrl, queryData)
      const token = data.data.token

      await tokens.insert({'token': token})
      await db.close()
      await console.log(`NEW Token:  ${token}`)

      return token
    } catch (err) {
      console.error('createToken', err.response.data)
    }
  }

  /**
   * @description 检查 Token 有效性
   *
   * @param token 待检查的 Token
   * @returns {Promise.<*>}
   */
  const checkToken = async function (token) {
    try {
      const queryUrl = `${config.fmsUrl}record/${config.solution}/${config.authLayout}`

      await axios.create({'headers': { 'fm-data-token': token }}).get(queryUrl)

      return token
    } catch (err) {
      if (err.response.data.errorCode.toString() === '952') {
        console.error('FMS Token:  Invalid')
        const newToken = await createToken()

        return newToken
      }
    }
  }

  let token = await searchToken() || await createToken()

  await checkToken(token)

  return token
}

/**
 * @description 创建并返回对象 id 信息
 *
 * @param layout 需要新建对象的上下文布局
 * @param data 新建对象的构成数据
 * @returns {Promise.<void>} 新建对象的id，以及操作是否成功
 */
async function newRecord (layout, data) {
  try {
    const url = `${config.fmsUrl}record/${config.solution}/${layout}`
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).post(url, {'data': data})

    return result.data
  } catch (err) {
    throw err.response.data
  }
}

/**
 * @description 获取指定 id 对象的内容
 *
 * @param {string} layout 需要搜索对象的上下文布局
 * @param {string} id 指定记录的 id 值
 * @returns object 指定记录的对象
 */
async function getOne (layout, id) {
  try {
    const url = `${config.fmsUrl}record/${config.solution}/${layout}/${id}?`
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).get(url)

    return result.data.data[0]
  } catch (err) {
    throw err.response.data
  }
}

/**
 * @description 获取指定布局中的所有记录
 *
 * @param layout 需要搜索对象的上下文布局
 * @param offset 第一条记录的起始点
 * @param range 需要包含的个数
 * @returns {Promise.<void>}
 */
async function getAll (layout, offset, range) {
  // TODO: sort, portal, offsetOrders, rangeOrders
  try {
    const url = `${config.fmsUrl}record/${config.solution}/${layout}?`
    const option = `offset=${offset}&range=${range}`
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).get(url + option)

    return result.data.data
  } catch (err) {
    throw err.response.data
  }
}

/**
 * @description 编辑指定 id 的记录
 *
 * @param layout 需要编辑对象的上下文布局
 * @param id 需要编辑对象的 id
 * @param data 对象新的数据
 * @returns {Promise.<void>}
 */
async function editRecord (layout, id, data) {
  try {
    const url = `${config.fmsUrl}record/${config.solution}/${layout}/${id}`
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).put(url, {'data': data})

    return result.data
  } catch (err) {
    throw err.response.data
  }
}

/**
 * @description 删除指定 id 的记录
 *
 * @param layout 需要删除对象的上下文布局
 * @param id 需要删除对象的 id
 * @returns {Promise.<void>}
 */
async function deleteRecord (layout, id) {
  try {
    const url = `${config.fmsUrl}record/${config.solution}/${layout}/${id}`
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).delete(url)

    return result.data
  } catch (err) {
    throw err.response.data
  }
}

/**
 * @description 按指定条件查找记录
 *
 * @param {string} layout  查找内容的上下文布局名称
 * @param {object} query  查询内容
 * @param {int} offset  第一条记录的起始点
 * @param {number} range  需要包含的个数
 * @returns array 搜索到的内容数组
 * @see tips: https://fmhelp.filemaker.com/help/16/fmp/en/FMP_Help/finding-text.html
 * @see tips: https://fmhelp.filemaker.com/help/16/fmp/en/FMP_Help/finding-empty-non-empty-fields.html
 */
async function findRecord (layout, query, offset, range) {
  // TODO: sort, portal, offsetOrders, rangeOrders
  try {
    const url = `${config.fmsUrl}find/${config.solution}/${layout}?`
    const option = `offset=${offset}&range=${range}`
    const data = {'query': query}
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).post(url + option, data)

    return result.data.data
  } catch (err) {
    throw err.response.data
  }
}

/**
 * @description 设置全局字段值
 *
 * @param {string} layout  查找内容的上下文布局名称
 * @param {object} data 编辑变量及对应的值
 * @returns
 */
async function setGlobal (layout, data) {
  try {
    const url = `${config.fmsUrl}global/${config.solution}/${layout}/`
    const result = await axios.create({'headers': { 'fm-data-token': await getToken() }}).put(url, {'globalFields': data})

    return result.data
  } catch (err) {
    throw err.response.data
  }
}

module.exports = {
  getToken,
  newRecord,
  editRecord,
  getOne,
  getAll,
  deleteRecord,
  findRecord,
  setGlobal
}
