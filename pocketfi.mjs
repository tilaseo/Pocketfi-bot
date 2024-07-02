import axios from 'axios';
import fs from 'fs';
import moment from 'moment';
import { HttpsProxyAgent } from 'https-proxy-agent';
import pLimit from 'p-limit';

// Đọc dữ liệu từ file
const readAccounts = () => {
  const data = fs.readFileSync('data.txt', 'utf-8');
  return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
};

// Đọc danh sách proxy từ file
const readProxies = () => {
  const data = fs.readFileSync('proxy.txt', 'utf-8');
  return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
};

// Tạo cấu hình proxy
const createProxyConfig = (proxyString) => {
  return proxyString; // Trả về chuỗi proxy đầy đủ
};

// Khai báo chung các header
const commonHeaders = {
  'Cache-Control': 'no-cache',
  'Host': 'rubot.pocketfi.org',
  'Origin': 'https://pocketfi.app',
  'Pragma': 'no-cache',
  'Referer': 'https://pocketfi.app/',
  'Sec-Ch-Ua': 'Not/A)Brand";v="8", "Chromium";v="98", "Google Chrome";v="98',
  'Sec-Ch-Ua-Mobile': '?1',
  'Sec-Ch-Ua-Platform': 'iOS',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'cors',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/98.0.4758.85 Mobile/15E148 Safari/604.1'
};

// Tạo instance Axios với proxy
const createAxiosInstance = (proxyUrl) => {
  const agent = new HttpsProxyAgent(proxyUrl);
  return axios.create({
    headers: commonHeaders,
    httpsAgent: agent
  });
};

// Hàm gửi yêu cầu POST
const claimMining = async (telegramData, index, axiosInstance) => {
  const postConfig = {
    method: 'post',
    url: 'https://rubot.pocketfi.org/mining/claimMining',
    headers: {
      ...commonHeaders,
      'Telegramrawdata': telegramData
    }
  };

  try {
    await axiosInstance(postConfig);
    return 'Claim Thành Công';
  } catch (error) {
    throw new Error(`Claim thất bại: ${error.message}`);
  }
};

// Hàm gửi yêu cầu GET và in giá trị gotAmount
const getUserMining = async (telegramData, index, axiosInstance) => {
  const getConfig = {
    method: 'get',
    url: 'https://rubot.pocketfi.org/mining/getUserMining',
    headers: {
      ...commonHeaders,
      'Telegramrawdata': telegramData
    }
  };

  try {
    const response = await axiosInstance(getConfig);
    const gotAmount = response.data.userMining.gotAmount;
    return `BALANCE: ${gotAmount}`;
  } catch (error) {
    throw new Error(`Lấy balance thất bại: ${error.message}`);
  }
};

// Hàm kích hoạt boost hàng ngày
const activateDailyBoost = async (telegramData, axiosInstance) => {
  const postConfig = {
    method: 'post',
    url: 'https://rubot.pocketfi.org/boost/activateDailyBoost',
    headers: {
      ...commonHeaders,
      'Telegramrawdata': telegramData
    }
  };

  try {
    await axiosInstance(postConfig);
    return 'Daily Boost Thành Công';
  } catch (error) {
    throw new Error(`Daily Boost thất bại: ${error.message}`);
  }
};

// Hàm xác nhận subscription
const confirmSubscription = async (telegramData, subscriptionType, axiosInstance) => {
  const postConfig = {
    method: 'post',
    url: 'https://rubot.pocketfi.org/confirmSubscription',
    headers: {
      ...commonHeaders,
      'Telegramrawdata': telegramData
    },
    data: {
      subscriptionType
    }
  };

  try {
    await axiosInstance(postConfig);
    return `Subscription ${subscriptionType} Thành Công`;
  } catch (error) {
    throw new Error(`Subscription ${subscriptionType} thất bại: ${error.message}`);
  }
};

// Hàm xử lý cho mỗi tài khoản
const processAccount = async (telegramData, index, proxyList) => {
  let proxyIndex = index % proxyList.length;
  let proxyUrl = createProxyConfig(proxyList[proxyIndex]);
  let axiosInstance = createAxiosInstance(proxyUrl);

  try {
    const claimResult = await claimMining(telegramData, index, axiosInstance);
    const balanceResult = await getUserMining(telegramData, index, axiosInstance);
    const boostResult = await activateDailyBoost(telegramData, axiosInstance);
    const twitterSubResult = await confirmSubscription(telegramData, 'twitter', axiosInstance);
    const telegramSubResult = await confirmSubscription(telegramData, 'telegram', axiosInstance);
    console.log(`Account ${index + 1} - ${balanceResult} - ${claimResult} - ${boostResult} - ${twitterSubResult} - ${telegramSubResult}`);
  } catch (error) {
    console.error(`Account ${index + 1} thất bại với proxy: ${proxyList[proxyIndex]}. Thử lại với proxy khác.`);
    // Thử lại với proxy khác
    for (let i = 1; i < proxyList.length; i++) {
      proxyIndex = (proxyIndex + 1) % proxyList.length;
      proxyUrl = createProxyConfig(proxyList[proxyIndex]);
      axiosInstance = createAxiosInstance(proxyUrl);
      try {
        const claimResult = await claimMining(telegramData, index, axiosInstance);
        const balanceResult = await getUserMining(telegramData, index, axiosInstance);
        const boostResult = await activateDailyBoost(telegramData, axiosInstance);
        const twitterSubResult = await confirmSubscription(telegramData, 'twitter', axiosInstance);
        const telegramSubResult = await confirmSubscription(telegramData, 'telegram', axiosInstance);
        console.log(`Account ${index + 1} - ${balanceResult} - ${claimResult} - ${boostResult} - ${twitterSubResult} - ${telegramSubResult}`);
        break; // Nếu thành công thì thoát khỏi vòng lặp
      } catch (retryError) {
        console.error(`Account ${index + 1} thất bại với proxy: ${proxyList[proxyIndex]}.`);
      }
    }
  }
};

// Hàm chính thực hiện tuần tự các tác vụ
const main = async () => {
  const telegramDataList = readAccounts();
  const proxyList = readProxies();

  const numAccounts = telegramDataList.length;
  const numProxies = proxyList.length;

  console.log(`Số lượng tài khoản hiện có: ${numAccounts}`);

  const limit = pLimit(10); // Giới hạn số lượng yêu cầu đồng thời là 10

  const tasks = telegramDataList.map((telegramData, i) => {
    return limit(() => processAccount(telegramData, i, proxyList));
  });

  await Promise.all(tasks);

  console.log(`\nĐã Xong!`);
  console.log(`\nBắt đầu đếm ngược 2h...`);
  const twoHours = moment.duration(2, 'hours').asMilliseconds();
  const endTime = moment().add(twoHours, 'milliseconds');

  while (moment().isBefore(endTime)) {
    const remaining = moment.duration(endTime.diff(moment()));
    const hours = remaining.hours();
    const minutes = remaining.minutes();
    const seconds = remaining.seconds();
    process.stdout.write(`\rChờ đợi: ${hours}h ${minutes}m ${seconds}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\n'); // Đảm bảo dòng tiếp theo bắt đầu từ đầu dòng mới
};

// Chạy hàm chính
main().catch(console.error);