// 根据当前时间返回合适的问候语
export function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 6) {
    return '夜深了，注意休息';
  } else if (hour < 9) {
    return '早上好，开启专注的一天';
  } else if (hour < 12) {
    return '上午好，保持专注';
  } else if (hour < 14) {
    return '中午好，适当休息';
  } else if (hour < 18) {
    return '下午好，继续加油';
  } else if (hour < 22) {
    return '晚上好，巩固今日所学';
  } else {
    return '夜深了，注意休息';
  }
}
