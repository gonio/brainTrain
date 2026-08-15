// 找谬误题库：移植自 BrainLogic（E:/logic/server/src/games/fallacy/questions.json），31 题原样。
// id 在移植时按顺序生成（fq-01..fq-31）。
import type { FallacyQuestion } from './fallacyEngine';

export const FALLACY_BANK: FallacyQuestion[] = [
  {
    "id": "fq-01",
    "fallacyType": "偷换概念",
    "title": "打折的诱惑",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "这家店的商品一律打五折。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "五折就是半价，半价等于不要钱。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "所以这些商品都是白送的！",
        "isFallacy": false
      }
    ],
    "explanation": "把「半价」偷换成「不要钱」。半价是付一半的钱，不是不付钱，同一个「便宜」被悄悄换了含义。"
  },
  {
    "id": "fq-02",
    "fallacyType": "偷换概念",
    "title": "锻炼的好处",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "研究表明规律运动有益健康。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "既然运动有益，那越多越好。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "所以每天跑马拉松一定最健康。",
        "isFallacy": false
      }
    ],
    "explanation": "把「有益健康」偷换成「越多越健康」。适量有益不等于无限有益，这是对「有益」的偷换。"
  },
  {
    "id": "fq-03",
    "fallacyType": "偷换概念",
    "title": "学习的理由",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "读书能增长见识。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "见识广的人更容易成功。",
        "isFallacy": false
      },
      {
        "id": 2,
        "text": "可见只要读书就一定会成功。",
        "isFallacy": true
      }
    ],
    "explanation": "把「更容易成功」偷换成「一定会成功」。概率高被悄悄换成了必然，这是偷换了成功的确定性。"
  },
  {
    "id": "fq-04",
    "fallacyType": "偷换概念",
    "title": "便宜的咖啡",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "这家咖啡只要十块钱，比星巴克便宜。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "便宜的东西都是好东西。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "所以这杯咖啡一定很好喝。",
        "isFallacy": false
      }
    ],
    "explanation": "把「便宜」偷换成「好」。便宜只说明价格低，和品质好坏没有必然关系。"
  },
  {
    "id": "fq-05",
    "fallacyType": "滑坡",
    "title": "玩游戏的后果",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "你今天又玩游戏了。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "玩游戏就会上瘾，上瘾就会荒废学业，荒废学业就找不到工作，最后流落街头。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "你看，玩一次游戏等于毁了一辈子。",
        "isFallacy": false
      }
    ],
    "explanation": "从「玩游戏」一路滑坡到「流落街头」，中间每一步都缺乏依据。玩游戏不必然上瘾，上瘾不必然荒废，每环都经不起推敲。"
  },
  {
    "id": "fq-06",
    "fallacyType": "滑坡",
    "title": "迟到的学生",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "小明今天上课迟到了五分钟。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "今天迟到五分钟，明天迟到十分钟，后天就不来了，最后退学。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "必须立刻开除，否则后果不堪设想。",
        "isFallacy": false
      }
    ],
    "explanation": "把「迟到一次」无限放大到「退学」，中间没有任何因果证据。迟到五分钟和退学之间隔着无数个没有发生的环节。"
  },
  {
    "id": "fq-07",
    "fallacyType": "滑坡",
    "title": "不叠被子",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "你不叠被子，说明你不爱整洁。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "不爱整洁就会不爱干净，不爱干净就会生病，生病就会传染全家。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "你这是在害全家人！",
        "isFallacy": false
      }
    ],
    "explanation": "从不叠被子滑坡到害全家，每一步都是无根据的推测。叠不叠被子和生病之间没有必然因果链。"
  },
  {
    "id": "fq-08",
    "fallacyType": "稻草人",
    "title": "加班之争",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "我认为公司应该减少不必要的加班。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "你的意思是让大家天天准时下班、什么都不干、公司倒闭算了？",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "这种想法太幼稚了。",
        "isFallacy": false
      }
    ],
    "explanation": "原意是「减少不必要的加班」，却被曲解成「什么都不干、让公司倒闭」。立了一个对方从没说过的稻草人靶子来攻击。"
  },
  {
    "id": "fq-09",
    "fallacyType": "稻草人",
    "title": "教育经费",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "建议适当增加教育投入。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "你是要把所有预算都砸给学校、不管其他民生了吗？",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "那医院、道路怎么办？",
        "isFallacy": false
      }
    ],
    "explanation": "把「适当增加教育投入」歪曲成「所有预算都给学校」。对方说的是适当增加，不是无限倾斜，这是典型的稻草人。"
  },
  {
    "id": "fq-10",
    "fallacyType": "稻草人",
    "title": "环保倡议",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "我提倡少用一次性塑料袋。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "哦，所以你要让我们回到石器时代、什么现代用品都不用？",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "真是荒谬至极。",
        "isFallacy": false
      }
    ],
    "explanation": "把「少用塑料袋」夸大成「回到石器时代」。对方只说了少用一种东西，却被说成反对一切现代用品。"
  },
  {
    "id": "fq-11",
    "fallacyType": "稻草人",
    "title": "健康饮食",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "建议大家少喝含糖饮料。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "你是要禁止所有人喝一切甜的东西、剥夺大家唯一的快乐吗？",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "这太极端了。",
        "isFallacy": false
      }
    ],
    "explanation": "把「少喝含糖饮料」曲解成「禁止所有甜味饮料、剥夺快乐」。少喝不等于禁止，这是立了个夸张的靶子。"
  },
  {
    "id": "fq-12",
    "fallacyType": "诉诸权威",
    "title": "明星代言",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "这位影帝都在用这款护肤品。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "既然大明星都用了，那肯定效果特别好。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "你也赶紧买吧。",
        "isFallacy": false
      }
    ],
    "explanation": "影帝是表演领域的权威，不是皮肤科专家。用演员的身份来背书护肤品效果，权威领域不对口。"
  },
  {
    "id": "fq-13",
    "fallacyType": "诉诸权威",
    "title": "专家的领域",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "一位诺贝尔物理学奖得主公开表示某保健品有效。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "他是诺贝尔奖得主啊，所以他说的肯定对。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "诺贝尔奖得主不会骗人的。",
        "isFallacy": false
      }
    ],
    "explanation": "物理学奖得主的权威在物理学，不是保健品。专业领域之外的发言不能凭头衔就当真。"
  },
  {
    "id": "fq-14",
    "fallacyType": "诉诸权威",
    "title": "古代的智慧",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "古人几千年前就记载了这个偏方。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "既然流传了这么多年，那肯定是有道理的、有效的。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "老祖宗的智慧不会错的。",
        "isFallacy": false
      }
    ],
    "explanation": "流传时间长不等于有效。「古老」被当成权威来背书，但传统本身不提供任何有效性证据。"
  },
  {
    "id": "fq-15",
    "fallacyType": "诉诸权威",
    "title": "名人的观点",
    "difficulty": 3,
    "material": [
      {
        "id": 0,
        "text": "某知名企业家在采访中说这款理财书改变了他的一生。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "他身家百亿，他推荐的书一定是真理。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "按他说的做你也能成为亿万富翁。",
        "isFallacy": false
      }
    ],
    "explanation": "企业家的成功不等于他的所有推荐都是对的。用财富数字来背书一本书的价值，混淆了「成功」和「正确」。"
  },
  {
    "id": "fq-16",
    "fallacyType": "诉诸情感",
    "title": "捐款的压力",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "想想那些可怜的孩子吧，他们连饭都吃不饱。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "如果你不捐钱，你就是冷血无情的人。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "你忍心看着他们受苦吗？",
        "isFallacy": false
      }
    ],
    "explanation": "用「冷血无情」进行道德绑架来逼迫捐款。该不该捐是个人选择，用情感攻势替代理性理由，和捐款这件事本身是否合理无关。"
  },
  {
    "id": "fq-17",
    "fallacyType": "诉诸情感",
    "title": "支持的姿态",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "你不同意我的方案，就是不爱这个团队。",
        "isFallacy": true
      },
      {
        "id": 1,
        "text": "我们这么辛苦你看到了吗？",
        "isFallacy": false
      },
      {
        "id": 2,
        "text": "不支持就是不感恩。",
        "isFallacy": false
      }
    ],
    "explanation": "把对方案的不同意见和「不爱团队」「不感恩」绑定，用情感绑架替代方案本身的讨论。不同意方案不等于不爱团队。"
  },
  {
    "id": "fq-18",
    "fallacyType": "诉诸情感",
    "title": "可怜的卖家",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "我已经亏本卖了，再便宜我就要喝西北风了。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "你好意思跟我砍价吗？我上有老下有小。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "行行好吧。",
        "isFallacy": false
      }
    ],
    "explanation": "用「上有老下有小」的悲情来阻止砍价。价格是否合理和卖家的个人境况无关，这是用同情心替代交易逻辑。"
  },
  {
    "id": "fq-19",
    "fallacyType": "诉诸情感",
    "title": "愤怒的指控",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "对于这个政策我有不同看法。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "你竟然反对？你对得起那些为此付出的人吗？你有没有良心？",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "太让人寒心了。",
        "isFallacy": false
      }
    ],
    "explanation": "用「有没有良心」「对不对得起」的愤怒情感来压制理性讨论。对政策有不同看法是正常的，和良心无关。"
  },
  {
    "id": "fq-20",
    "fallacyType": "虚假二分",
    "title": "要么要么",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "你要么全力支持我，要么就是反对我。",
        "isFallacy": true
      },
      {
        "id": 1,
        "text": "不支持就是敌人。",
        "isFallacy": false
      },
      {
        "id": 2,
        "text": "你自己选吧。",
        "isFallacy": false
      }
    ],
    "explanation": "把世界简化成只有「全力支持」和「反对」两个选项。实际上还有部分支持、有条件支持、中立等多种立场，这是虚假二分。"
  },
  {
    "id": "fq-21",
    "fallacyType": "虚假二分",
    "title": "成功的定义",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "不上名校的孩子以后不会有出息。",
        "isFallacy": true
      },
      {
        "id": 1,
        "text": "所以必须考上名牌大学。",
        "isFallacy": false
      },
      {
        "id": 2,
        "text": "否则就完了。",
        "isFallacy": false
      }
    ],
    "explanation": "把出路简化成「上名校=有出息，不上=没出息」。实际上成功的路径有很多，不上名校也能有出息，这是虚假二分。"
  },
  {
    "id": "fq-22",
    "fallacyType": "虚假二分",
    "title": "工作的选择",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "你要么接受这份工作的所有条件，要么就别干。",
        "isFallacy": true
      },
      {
        "id": 1,
        "text": "没有中间地带。",
        "isFallacy": false
      }
    ],
    "explanation": "把选择简化成「全盘接受」或「不干」。实际上可以协商薪资、谈判条件、部分接受，这是制造了虚假的非此即彼。"
  },
  {
    "id": "fq-23",
    "fallacyType": "虚假二分",
    "title": "爱国的姿态",
    "difficulty": 3,
    "material": [
      {
        "id": 0,
        "text": "你不用国货就是不爱国。",
        "isFallacy": true
      },
      {
        "id": 1,
        "text": "爱国的人一定只买国货。",
        "isFallacy": false
      },
      {
        "id": 2,
        "text": "不然呢？",
        "isFallacy": false
      }
    ],
    "explanation": "把爱国简化成「用不用国货」两个选项。爱国与否和消费选择之间没有必然的二分关系，这是强行制造非此即彼。"
  },
  {
    "id": "fq-24",
    "fallacyType": "幸存者偏差",
    "title": "辍学的天才",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "比尔·盖茨和扎克伯格都是大学辍学后成功的。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "可见辍学才是成功的关键。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "想成功就别上学了。",
        "isFallacy": false
      }
    ],
    "explanation": "只看到辍学后成功的少数幸存者，忽略了成千上万辍学后失败的沉默多数。用个案当规律，是典型的幸存者偏差。"
  },
  {
    "id": "fq-25",
    "fallacyType": "幸存者偏差",
    "title": "古老的建筑",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "你看这些几百年前的石头建筑至今坚固。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "古人的建筑技术一定比现在好。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "现在的工程都是豆腐渣。",
        "isFallacy": false
      }
    ],
    "explanation": "能留存至今的只是当年最坚固的那些建筑，大量早已坍塌的消失在历史里。拿幸存的精品去代表整体水平，是幸存者偏差。"
  },
  {
    "id": "fq-26",
    "fallacyType": "幸存者偏差",
    "title": "战机的装甲",
    "difficulty": 3,
    "material": [
      {
        "id": 0,
        "text": "返航的战机机翼上弹孔最多。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "所以应该加固机翼，因为那是被打中最多的地方。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "数据不会骗人嘛。",
        "isFallacy": false
      }
    ],
    "explanation": "返航的战机是幸存者——它们机翼中弹还能飞回来。真正致命的是被击中就没回来的那些（引擎、驾驶舱），这才是经典的幸存者偏差案例。"
  },
  {
    "id": "fq-27",
    "fallacyType": "幸存者偏差",
    "title": "长寿的秘诀",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "采访百岁老人，他们都说每天喝点小酒。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "所以喝酒能长寿。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "看，人家就是活证据。",
        "isFallacy": false
      }
    ],
    "explanation": "只采访了活到百岁的幸存者，没统计同样喝酒却早逝的人。用幸存者的习惯反推长寿秘诀，忽略了沉默的对照组。"
  },
  {
    "id": "fq-28",
    "fallacyType": "循环论证",
    "title": "权威的权威",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "这本书一定是对的。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "因为它是权威写的。",
        "isFallacy": false
      },
      {
        "id": 2,
        "text": "权威为什么权威？因为他说的话都对，就像这本书。",
        "isFallacy": true
      }
    ],
    "explanation": "用「权威写的」证明书对，又用「书对」证明作者权威，A证明B、B证明A，绕了一圈没有给出任何独立证据。"
  },
  {
    "id": "fq-29",
    "fallacyType": "循环论证",
    "title": "真药的效果",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "这药有效，因为我吃了之后好了。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "怎么证明是药治好的？因为药是有效的嘛。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "药有效所以病好了，病好了说明药有效。",
        "isFallacy": false
      }
    ],
    "explanation": "用「药有效」解释病好，又用病好证明药有效，循环一圈没有引入任何外部证据（如对照组、成分分析）。"
  },
  {
    "id": "fq-30",
    "fallacyType": "循环论证",
    "title": "可信的消息",
    "difficulty": 2,
    "material": [
      {
        "id": 0,
        "text": "这消息是真的，因为是官方网站发的。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "官方网站为什么可信？因为它只发真消息啊。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "你看，这就是真的。",
        "isFallacy": false
      }
    ],
    "explanation": "用「官方网站」证明消息真，又用「只发真消息」证明官方可信，A绕回A，没有提供任何独立的可信度证据。"
  },
  {
    "id": "fq-31",
    "fallacyType": "循环论证",
    "title": "必读的书",
    "difficulty": 1,
    "material": [
      {
        "id": 0,
        "text": "这本书你必须读，因为它特别重要。",
        "isFallacy": false
      },
      {
        "id": 1,
        "text": "为什么重要？因为它是每个人都必读的书。",
        "isFallacy": true
      },
      {
        "id": 2,
        "text": "所以你还不去读？",
        "isFallacy": false
      }
    ],
    "explanation": "用「重要」解释为什么必读，又用「必读」解释为什么重要，两个说法互相证明，没说出到底重要在哪里。"
  }
];

/** 按难度随机抽一题（difficulty 1=入门 2=进阶 3=挑战） */
export function pickFallacyQuestion(
  difficulty: 1 | 2 | 3,
  rng: () => number = Math.random,
): FallacyQuestion {
  const pool = FALLACY_BANK.filter((q) => q.difficulty === difficulty);
  if (pool.length === 0) throw new Error(`题库难度 ${difficulty} 无题`);
  return pool[Math.floor(rng() * pool.length)];
}
