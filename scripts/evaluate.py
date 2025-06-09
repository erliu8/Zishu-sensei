import sys
import os
import json
import torch
import numpy as np
import pandas as pd
from pathlib import Path
import logging
from datetime import datetime
from collections import defaultdict
import matplotlib.pyplot as plt
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel

# 添加项目根目录到路径
ROOT_DIR = Path(__file__).resolve().parent.parent  # 上升一级到项目根目录
sys.path.append(str(ROOT_DIR))

from src.model.lora import LoraManager

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("anime_evaluation.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AnimeEvaluator:
    """二次元能力评估器"""
    
    def __init__(self, model_config_path, adapter_path):
        self.model_config_path = Path(model_config_path)
        self.adapter_path = Path(adapter_path)
        
        # 初始化模型
        self.lora_manager = LoraManager(config_path=self.model_config_path, device="cuda")
        self.model = self.lora_manager.load_model()
        self.tokenizer = self.lora_manager.load_tokenizer()
        
        # 加载语义相似度模型
        self.sim_model_name = "shibing624/text2vec-base-chinese"
        logger.info(f"尝试加载语义相似度模型: {self.sim_model_name}")
        try:
            # 离线模式加载选项，避免网络连接问题
            self.sim_tokenizer = AutoTokenizer.from_pretrained(
                self.sim_model_name, 
                local_files_only=True,  # 仅使用本地文件
                trust_remote_code=True
            )
            self.sim_model = AutoModel.from_pretrained(
                self.sim_model_name,
                local_files_only=True,  # 仅使用本地文件
                trust_remote_code=True
            )
            logger.info(f"成功加载语义相似度模型")
        except Exception as e:
            logger.warning(f"语义相似度模型加载失败: {e}")
            logger.info("使用备选方案: 简单字符匹配评估")
            self.sim_tokenizer = None
            self.sim_model = None
        
        # 评估结果
        self.results = defaultdict(dict)
        self.output_dir = Path("evaluation_results")
        self.output_dir.mkdir(exist_ok=True)
        
        # 评估时间
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def get_embedding(self, text):
        """获取文本的语义向量表示"""
        if self.sim_model is None:
            return None
            
        inputs = self.sim_tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.no_grad():
            outputs = self.sim_model(**inputs)
            
        # 平均池化得到句子向量
        attention_mask = inputs['attention_mask']
        embeddings = outputs.last_hidden_state
        mask = attention_mask.unsqueeze(-1).expand(embeddings.size()).float()
        masked_embeddings = embeddings * mask
        summed = torch.sum(masked_embeddings, 1)
        counts = torch.clamp(mask.sum(1), min=1e-9)
        mean_pooled = summed / counts
        return mean_pooled[0].numpy()
    
    def calculate_similarity(self, text1, text2):
        """计算两段文本的语义相似度"""
        if self.sim_model is None:
            # 退化为字符重合率
            common_chars = set(text1) & set(text2)
            total_chars = set(text1) | set(text2)
            return len(common_chars) / len(total_chars) if total_chars else 0
            
        emb1 = self.get_embedding(text1)
        emb2 = self.get_embedding(text2)
        similarity = cosine_similarity([emb1], [emb2])[0][0]
        return similarity
    
    def generate_response(self, prompt, max_tokens=512):
        """生成模型回答"""
        inputs = self.tokenizer(prompt, return_tensors="pt", padding=True).to(self.lora_manager.device)
        
        # 确保pad_token_id设置正确
        if self.tokenizer.pad_token_id is None:
            if self.tokenizer.eos_token_id is not None:
                self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
            else:
                self.tokenizer.pad_token_id = 0  # 使用一个安全的默认值
        
        with torch.no_grad():
            outputs = self.model.generate(
                input_ids=inputs.input_ids,
                attention_mask=inputs.attention_mask,
                max_new_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                pad_token_id=self.tokenizer.pad_token_id
            )
        
        response = self.tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return response
    
    def evaluate_terminology(self):
        """评估二次元术语理解"""
        logger.info("开始评估二次元术语理解能力...")
        
        terminology_data = [
            {
                "term": "萌",
                "prompt": "请详细解释动漫中\"萌\"的概念及其起源和演变。",
                "reference": "萌是一种源自日本的情感反应，最初源于1990年代的动画作品，表示对可爱事物产生的喜爱之情。这个词最早出现在动画《新世纪福音战士》中。萌的概念随着时间演变，扩展到描述各种引发保护欲和喜爱的角色特质，如天真、纯洁、弱小等。现在萌已成为ACG文化的核心概念，影响了角色设计和作品创作。"
            },
            {
                "term": "中二病",
                "prompt": "什么是\"中二病\"？请从二次元文化角度详细解释其含义、起源和在动漫中的表现。",
                "reference": "中二病(Chunibyo)是指青少年时期的自我意识过剩和行为怪异的状态，源自日本作家水岛努的小说。在动漫中，中二病角色通常自称拥有特殊能力、使用夸张言辞、声称背负黑暗命运，或发明复杂的世界观和设定。《中二病也要谈恋爱》等作品将这一概念发扬光大，中二病角色在动漫中往往戴眼罩、缠绷带，自称\"黑暗使者\"等，这种设定既引人发笑又引发共鸣。"
            },
            {
                "term": "傲娇",
                "prompt": "解释什么是\"傲娇\"角色，并举例说明这类角色在动漫中的典型言行特征。",
                "reference": "傲娇(Tsundere)是日本动漫中常见的角色类型，指表面高傲冷漠但内心温柔的角色。这类角色对喜欢的人常表现出矛盾态度：一边严厉批评，一边又默默关心。典型特征包括\"才不是为你做的\"等否认善意的台词、脸红害羞、难以坦率表达感情、情绪剧烈波动等。代表角色有《灼眼的夏娜》中的夏娜、《EVA》中的明日香、《命运石之门》中的牧濑红莉栖等。傲娇角色在日本动漫中极受欢迎，成为一种经典的性格类型。"
            },
            {
                "term": "轻小说",
                "prompt": "什么是\"轻小说\"？请详细介绍其定义、特点、发展历史及与动漫产业的关系。",
                "reference": "轻小说是起源于日本的一种文学形式，针对青少年读者群体，特点是文风轻松、篇幅适中、插图精美、情节紧凑。始于1970年代，兴盛于2000年代。轻小说通常包含动漫风格插画，题材多样，如异世界、校园、恋爱等。与动漫产业关系密切，常被改编为动画、漫画和游戏，形成跨媒体产业链。代表作品有《凉宫春日的忧郁》、《魔法科高校的劣等生》、《刀剑神域》等。轻小说已成为日本文化输出的重要组成部分，并影响了全球流行文化。"
            },
            {
                "term": "同人志",
                "prompt": "请详细解释\"同人志\"在ACG文化中的定义、发展历史、类型以及其文化意义。",
                "reference": "同人志是指粉丝基于已有作品创作的非官方出版物，起源于20世纪70年代日本，最初在Comic Market等同人展会上交流。同人志主要分为原创类和二次创作类，形式包括漫画、小说、插画集等。在ACG文化中，同人志是粉丝表达创造力的重要媒介，促进了粉丝社群形成，也是原创作者的训练场。许多职业漫画家如CLAMP团队最初就从同人创作起步。同人志不仅丰富了原作的世界观，还推动了二次元文化的多元发展，体现了参与式文化的特点。在法律上，同人志处于灰色地带，但日本出版业对此采取了相对宽容的态度。"
            }
        ]
        
        results = []
        term_scores = {}
        
        for item in terminology_data:
            term = item["term"]
            prompt = item["prompt"]
            reference = item["reference"]
            
            logger.info(f"测试术语: {term}")
            response = self.generate_response(prompt)
            
            # 计算相似度
            similarity = self.calculate_similarity(response, reference)
            
            # 关键词检测
            key_concepts = self.extract_key_concepts(term)
            concept_found = 0
            for concept in key_concepts:
                if concept in response:
                    concept_found += 1
            concept_coverage = concept_found / len(key_concepts) if key_concepts else 0
            
            # 信息准确性评分 (70%相似度 + 30%概念覆盖)
            accuracy = similarity * 0.7 + concept_coverage * 0.3
            
            # 词汇丰富度 (每100字中的独特词汇数)
            unique_words = len(set(response))
            vocab_richness = unique_words / (len(response) / 100)
            
            # 记录结果
            result = {
                "术语": term,
                "问题": prompt,
                "模型回答": response,
                "参考答案": reference,
                "语义相似度": similarity,
                "概念覆盖率": concept_coverage,
                "准确性评分": accuracy,
                "词汇丰富度": vocab_richness
            }
            results.append(result)
            term_scores[term] = accuracy
        
        # 计算术语理解的总体得分
        avg_score = np.mean([r["准确性评分"] for r in results])
        
        # 保存评估结果
        self.results["术语理解"] = {
            "详细评分": results,
            "各术语得分": term_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"术语理解评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def extract_key_concepts(self, term):
        """提取术语相关的关键概念"""
        concept_map = {
            "萌": ["可爱", "喜爱", "保护欲", "福音战士", "MOE", "萌元素", "萌属性"],
            "中二病": ["青少年", "特殊能力", "夸张", "黑暗", "中学二年级", "自我意识", "设定"],
            "傲娇": ["高傲", "害羞", "别扭", "内心", "温柔", "矛盾", "tsundere", "明日香"],
            "轻小说": ["插图", "青少年", "文体", "简单", "动画改编", "卷", "系列", "校园"],
            "同人志": ["二次创作", "粉丝", "Comic Market", "版权", "同人展", "原创", "二创"]
        }
        return concept_map.get(term, [])

    def evaluate_cultural_knowledge(self):
        """评估二次元文化知识"""
        logger.info("开始评估二次元文化知识...")
        
        knowledge_data = [
            {
                "category": "经典作品",
                "prompt": "请详细介绍宫崎骏的代表作《千与千寻》，包括其故事内容、主题思想、艺术特色及文化影响。",
                "reference": "《千与千寻》是宫崎骏2001年的动画电影杰作，讲述10岁女孩千寻意外进入神灵世界，父母变成猪后，她必须在汤屋工作并寻找救出父母的方法。在这个过程中，她遇到了白龙等角色，经历成长。影片探讨了成长、环保、贪婪与救赎等主题，艺术上融合了日本传统与现代元素，场景设计极其细腻。作品获奥斯卡最佳动画长片等多项大奖，不仅是日本票房最高的电影之一，还对全球动画艺术产生深远影响，被誉为动画史上的经典之作。"
            },
            {
                "category": "动漫产业",
                "prompt": "请详细分析日本动漫产业的发展历史、商业模式、全球影响力以及面临的挑战。",
                "reference": "日本动漫产业始于1917年《芋川椋三》等早期作品，经历了手冢治虫的革新、80年代的黄金期、90年代的全球化扩张和数字化转型。其独特商业模式包括\"委员会制作\"分散风险、IP多元变现（动画、漫画、轻小说、游戏、周边）。全球影响方面，日本动漫塑造了独特美学风格，影响好莱坞和全球创作者，带动了漫展文化。产业挑战包括动画师低薪、制作成本上升、国际竞争加剧（如中国动画崛起）、盗版问题和内容同质化。近年来，数字平台如Netflix投资原创动画及技术创新如AI辅助制作，为产业带来新机遇。"
            },
            {
                "category": "二次元流行语",
                "prompt": "请解释\"我不要你觉得，我要我觉得\"、\"你币有了\"等二次元流行语的含义、起源和使用场景。",
                "reference": "这些是源自弹幕和网络的二次元流行语。\"我不要你觉得，我要我觉得\"出自斗鱼主播\"三笠\"，表达霸道不讲理态度，常用于调侃独断专行的人。\"你币有了\"源自游戏氪金文化，指玩家充值购买游戏内货币的行为，暗示\"你已上钩\"，常用于游戏推销或讽刺诱导消费。其他流行语如\"高能预警\"(提示精彩内容)、\"awsl\"(啊我死了，表达喜爱)等都体现了二次元文化的创造力和传播力，这些术语已超出动漫圈进入主流社交媒体，成为年轻人交流的文化密码。"
            },
            {
                "category": "动漫圣地巡礼",
                "prompt": "请详细介绍\"动漫圣地巡礼\"现象，并举例说明几个著名的动漫圣地及其对当地经济文化的影响。",
                "reference": "动漫圣地巡礼是指粉丝探访动漫作品取景或背景地的活动，始于1990年代，2000年代后随着《凉宫春日的忧郁》等作品走红而普及。著名圣地包括：《你的名字》的飞驒高山和糸守湖(实为诹访湖)，游客激增带动当地旅游业；《幸运星》的鹫宫神社成为粉丝朝圣地，带动周边经济；《轻音少女》取景的丰乡小学引来大量游客，拯救了衰退的当地经济。这种现象促进了地方创生，各地政府也主动与动画合作进行地方宣传，如《摇曳露营》与山梨县合作。圣地巡礼既满足粉丝情感需求，也促进文化旅游发展，形成了独特的文化经济生态系统。"
            },
            {
                "category": "声优文化",
                "prompt": "请分析日本声优文化的发展、声优在动漫产业中的地位、著名声优的影响力以及声优产业的商业模式。",
                "reference": "日本声优文化始于1960年代，经历了从幕后到台前的转变。早期声优如野沢雅子(孙悟空)默默工作，1990年代后声优逐渐成为明星。声优在产业中地位举足轻重，不仅赋予角色灵魂，还通过歌曲、广播剧等拓展IP价值。著名声优如花泽香菜、宫野真守、悠木碧等拥有庞大粉丝群体，跨界发展成为歌手、演员。商业模式包括配音工作、个人单曲、演唱会、见面会、广播节目和周边产品。声优事务所如81 Produce负责培训和经纪，有完整的选拔、培养体系。声优产业已形成完整生态，成为动漫产业的重要支柱和日本文化输出的一部分。"
            }
        ]
        
        results = []
        category_scores = {}
        
        for item in knowledge_data:
            category = item["category"]
            prompt = item["prompt"]
            reference = item["reference"]
            
            logger.info(f"测试知识类别: {category}")
            response = self.generate_response(prompt)
            
            # 计算相似度
            similarity = self.calculate_similarity(response, reference)
            
            # 内容深度评分 (基于回答长度与参考答案的比例)
            depth_ratio = len(response) / len(reference)
            depth_score = min(1.0, depth_ratio) # 不超过1
            
            # 细节准确性 (基于关键事实的覆盖)
            key_facts = self.extract_key_facts(category)
            facts_found = 0
            for fact in key_facts:
                if fact in response:
                    facts_found += 1
            facts_coverage = facts_found / len(key_facts) if key_facts else 0
            
            # 综合知识评分 (50%相似度 + 30%事实覆盖 + 20%深度)
            knowledge_score = similarity * 0.5 + facts_coverage * 0.3 + depth_score * 0.2
            
            # 记录结果
            result = {
                "知识类别": category,
                "问题": prompt,
                "模型回答": response,
                "参考答案": reference,
                "语义相似度": similarity,
                "事实覆盖率": facts_coverage,
                "内容深度评分": depth_score,
                "综合知识评分": knowledge_score
            }
            results.append(result)
            category_scores[category] = knowledge_score
        
        # 计算文化知识的总体得分
        avg_score = np.mean([r["综合知识评分"] for r in results])
        
        # 保存评估结果
        self.results["文化知识"] = {
            "详细评分": results,
            "各类别得分": category_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"文化知识评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def extract_key_facts(self, category):
        """提取知识类别相关的关键事实"""
        fact_map = {
            "经典作品": ["千寻", "白龙", "汤屋", "无脸男", "宫崎骏", "奥斯卡", "猪", "神灵", "成长"],
            "动漫产业": ["手冢治虫", "委员会制作", "IP", "周边", "全球化", "数字化", "低薪", "盗版"],
            "二次元流行语": ["弹幕", "三笠", "氪金", "高能预警", "awsl", "流行语", "网络用语"],
            "动漫圣地巡礼": ["取景地", "你的名字", "飞驒高山", "凉宫春日", "鹫宫神社", "地方创生", "旅游"],
            "声优文化": ["配音", "花泽香菜", "宫野真守", "演唱会", "事务所", "培训", "粉丝", "偶像"]
        }
        return fact_map.get(category, [])
    
    def evaluate_character_expression(self):
        """评估二次元角色表达能力"""
        logger.info("开始评估二次元角色表达能力...")
        
        expression_data = [
            {
                "role": "傲娇角色",
                "prompt": "假设你是一个傲娇类型的动漫角色，请用傲娇的语气和表达方式回应：\'我给你准备了生日礼物\'。",
                "reference": "哼！才、才不是特意为你准备的呢！只是刚好多买了一个，不要想太多了啦！...不过，如果你不要的话，我就扔掉了...当然，如果你喜欢的话...也不是不可以给你啦。只是下次不要期待了，知道吗！",
                "keywords": ["哼", "才不是", "不要想太多", "如果你喜欢", "不是不可以", "知道吗"]
            },
            {
                "role": "中二病角色",
                "prompt": "假设你是一个中二病动漫角色，请用中二病的语气描述你即将参加一场普通的期末考试。",
                "reference": "听好了，凡人们！黑暗的审判之日即将降临，吾之封印之力将接受命运的试炼！这不仅仅是你们所谓的\'期末考试\'，而是吾等与古老知识之间的契约之战！吾已于昨夜沐浴着月光，将知识的魔法阵刻印于吾之右眼，黑炎龙王的加护会指引吾找寻真理的道路！颤抖吧，考卷！汝将在吾的黑焰下灰飞烟灭！",
                "keywords": ["黑暗", "命运", "封印", "契约", "魔法阵", "加护", "颤抖吧", "灰飞烟灭"]
            },
            {
                "role": "元气少女",
                "prompt": "假设你是一个元气满满的动漫少女角色，请用这种角色特有的语气和说话方式描述你的早晨日常。",
                "reference": "呜哇~今天也是元气满满的一天呢！啊，已经7点了！不行不行，要迟到了说！呜咿——快点快点！唔姆~面包要边跑边吃才是青春的证明喵！啊，遇到隔壁班的大家了呢，早上好~！诶嘿嘿，今天也要加油努力，一起开开心心地度过这一天吧！Fighting~✿",
                "keywords": ["元气满满", "呜哇", "呜咿", "唔姆", "喵", "诶嘿嘿", "加油", "开心"]
            },
            {
                "role": "冷酷角色",
                "prompt": "假设你是一个性格冷酷的动漫角色，请用这种角色特有的语气和表达方式回应：\'我们能成为朋友吗？\'",
                "reference": "......无聊。我没有交朋友的兴趣。这种关系...只会成为累赘。如果你坚持的话...随你便。但别指望我会配合你的期待。我走的是独行的路，不需要任何人的理解或陪伴。",
                "keywords": ["无聊", "没有兴趣", "累赘", "随你便", "不需要", "独行"]
            },
            {
                "role": "大小姐角色",
                "prompt": "假设你是一个出身名门的大小姐动漫角色，请用大小姐特有的语气和表达方式对路人评价一家普通的快餐店。",
                "reference": "哼，这就是平民所谓的\'快餐店\'吗？真是难以理解呢～我偶尔对这类事物有些好奇罢了，别误会。嗯？这种不合格的座椅，竟敢让本小姐就坐？侍从，给我铺上手帕！还有，这菜单上的东西，统统都是用手拿着吃的吗？真是野蛮的习惯呢～不过，既然来了，本小姐就勉为其难地尝一尝吧！毕竟体验平民生活也是贵族的修养之一...啊啦，这个汉堡，味道竟然...不赖嘛！",
                "keywords": ["哼", "平民", "本小姐", "侍从", "野蛮", "勉为其难", "贵族", "修养"]
            }
        ]
        
        results = []
        role_scores = {}
        
        for item in expression_data:
            role = item["role"]
            prompt = item["prompt"]
            reference = item["reference"]
            keywords = item["keywords"]
            
            logger.info(f"测试角色表达: {role}")
            response = self.generate_response(prompt)
            
            # 风格相似度
            style_similarity = self.calculate_similarity(response, reference)
            
            # 关键词覆盖
            keywords_found = 0
            for keyword in keywords:
                if keyword in response:
                    keywords_found += 1
            keyword_coverage = keywords_found / len(keywords) if keywords else 0
            
            # 语气一致性 (基于语气词和特定表达方式)
            tone_markers = self.extract_tone_markers(role)
            markers_found = 0
            for marker in tone_markers:
                if marker in response:
                    markers_found += 1
            tone_consistency = markers_found / len(tone_markers) if tone_markers else 0
            
            # 角色表达评分 (40%风格相似度 + 30%关键词覆盖 + 30%语气一致性)
            expression_score = style_similarity * 0.4 + keyword_coverage * 0.3 + tone_consistency * 0.3
            
            # 记录结果
            result = {
                "角色类型": role,
                "问题": prompt,
                "模型回答": response,
                "参考回答": reference,
                "风格相似度": style_similarity,
                "关键词覆盖率": keyword_coverage,
                "语气一致性": tone_consistency,
                "角色表达评分": expression_score
            }
            results.append(result)
            role_scores[role] = expression_score
        
        # 计算角色表达的总体得分
        avg_score = np.mean([r["角色表达评分"] for r in results])
        
        # 保存评估结果
        self.results["角色表达"] = {
            "详细评分": results,
            "各角色得分": role_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"角色表达评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def extract_tone_markers(self, role):
        """提取角色语气的关键标记词"""
        marker_map = {
            "傲娇角色": ["哼", "才不是", "别误会", "不过", "笨蛋", "才没有", "！", "啦", "..."],
            "中二病角色": ["吾", "汝", "之", "黑暗", "命运", "力量", "召唤", "仪式", "契约", "封印"],
            "元气少女": ["呀", "呢", "啦", "哦", "喵", "呜", "诶嘿", "~", "嘛", "啊", "哇"],
            "冷酷角色": ["...", "无聊", "随便", "不需要", "无所谓", "弱小", "没兴趣", "愚蠢"],
            "大小姐角色": ["本小姐", "哼", "不过如此", "区区", "可笑", "野蛮", "平民", "贵族", "当然"]
        }
        return marker_map.get(role, [])
    
    def evaluate_creative_writing(self):
        """评估二次元创意写作能力"""
        logger.info("开始评估二次元创意写作能力...")
        
        writing_data = [
            {
                "genre": "轻小说开头",
                "prompt": "请以轻小说风格，写一个1000字以内的故事开头，主题是\"普通高中生发现自己的新同学是异世界公主\"。",
                "criteria": ["人物塑造", "世界观设定", "情节引入", "语言风格", "二次元元素"]
            },
            {
                "genre": "动漫台词",
                "prompt": "请创作一段约500字的动漫中最终决战前的主角励志台词，内容要热血、振奋人心。",
                "criteria": ["情感表达", "台词节奏", "主题深度", "语言特色", "戏剧性"]
            },
            {
                "genre": "架空设定",
                "prompt": "请创造一个独特的动漫世界观设定，包括魔法/能力系统、社会结构、重要地点和历史背景等，要有二次元特色且逻辑自洽。",
                "criteria": ["创意独特性", "系统完整性", "细节丰富度", "内部一致性", "二次元契合度"]
            }
        ]
        
        results = []
        genre_scores = {}
        
        for item in writing_data:
            genre = item["genre"]
            prompt = item["prompt"]
            criteria = item["criteria"]
            
            logger.info(f"测试创意写作: {genre}")
            response = self.generate_response(prompt, max_tokens=1024)
            
            # 评分各个标准 (主观评分转为算法评分)
            criterion_scores = {}
            for criterion in criteria:
                # 使用不同指标评估不同标准
                if criterion in ["人物塑造", "情感表达"]:
                    # 情感词汇丰富度
                    emotion_words = self.count_emotion_words(response)
                    score = min(1.0, emotion_words / 20)  # 每20个情感词满分
                    
                elif criterion in ["世界观设定", "创意独特性", "系统完整性"]:
                    # 专有名词密度
                    proper_nouns = self.extract_proper_nouns(response)
                    score = min(1.0, len(proper_nouns) / 15)  # 每15个专有名词满分
                    
                elif criterion in ["语言风格", "语言特色", "二次元契合度"]:
                    # 二次元特征词出现频率
                    anime_terms = self.count_anime_terms(response)
                    score = min(1.0, anime_terms / 10)  # 每10个二次元特征词满分
                    
                elif criterion in ["情节引入", "台词节奏", "戏剧性"]:
                    # 感叹句和对话的比例
                    exclamations = response.count('！') + response.count('!') 
                    dialogues = response.count('"') / 2  # 粗略估计对话数
                    score = min(1.0, (exclamations + dialogues) / 15)  # 每15个感叹/对话满分
                    
                else:  # ["主题深度", "细节丰富度", "内部一致性"]
                    # 文本长度和复杂度
                    length_score = min(1.0, len(response) / 800)  # 800字满分
                    unique_ratio = len(set(response)) / len(response) if response else 0
                    complexity_score = unique_ratio * 5  # 词汇多样性
                    score = (length_score + complexity_score) / 2
                
                criterion_scores[criterion] = score
            
            # 计算该类型的平均得分
            avg_criterion_score = np.mean(list(criterion_scores.values()))
            
            # 记录结果
            result = {
                "写作类型": genre,
                "问题": prompt,
                "模型回答": response,
                "评分标准": criterion_scores,
                "写作评分": avg_criterion_score
            }
            results.append(result)
            genre_scores[genre] = avg_criterion_score
        
        # 计算创意写作的总体得分
        avg_score = np.mean([r["写作评分"] for r in results])
        
        # 保存评估结果
        self.results["创意写作"] = {
            "详细评分": results,
            "各类型得分": genre_scores,
            "总体得分": avg_score
        }
        
        logger.info(f"创意写作评估完成，总体得分: {avg_score:.4f}")
        return avg_score
    
    def count_emotion_words(self, text):
        """计算文本中的情感词汇数量"""
        emotion_words_list = [
            "喜欢", "爱", "讨厌", "恨", "开心", "悲伤", "愤怒", "恐惧", "惊讶",
            "羞耻", "自豪", "嫉妒", "感动", "心痛", "忧郁", "激动", "兴奋", "沮丧",
            "绝望", "希望", "害怕", "担心", "高兴", "快乐", "痛苦", "温柔", "怀念",
            "思念", "无奈", "委屈", "后悔", "孤独", "向往", "厌恶", "欣赏", "敬佩",
            "羡慕", "感谢", "抱歉", "遗憾", "心跳", "眼泪", "微笑", "哭泣", "颤抖",
            "呐喊", "欢呼", "叹息", "紧张", "安心"
        ]
        count = 0
        for word in emotion_words_list:
            count += text.count(word)
        return count
    
    def extract_proper_nouns(self, text):
        """提取文本中可能的专有名词"""
        # 简易实现：提取引号中的内容和大写开头的词语作为专有名词
        proper_nouns = []
        
        # 提取引号中的内容
        import re
        quoted = re.findall(r'[「『""]([^」』""]*)["」』"]', text)
        proper_nouns.extend(quoted)
        
        # 提取可能的专有名词（包含特殊字符的词组）
        special_chars = ['·', '•', '-', '—', '・']
        for char in special_chars:
            if char in text:
                parts = text.split(char)
                for i in range(len(parts)-1):
                    compound = parts[i][-1] + char + parts[i+1][0]
                    if len(compound) > 3:  # 避免太短的组合
                        proper_nouns.append(compound)
        
        # 去重
        return list(set(proper_nouns))
    
    def count_anime_terms(self, text):
        """计算文本中二次元特征词的数量"""
        anime_terms_list = [
            "萌", "燃", "中二病", "傲娇", "元气", "大小姐", "学长", "前辈", "后辈",
            "笨蛋", "喵", "汪", "呜", "啊嘞", "诶嘿", "哇", "呐", "呜呜", "嘛",
            "魔法", "公主", "王子", "勇者", "魔王", "异世界", "转生", "封印", "必杀技",
            "成长", "友情", "羁绊", "约定", "命运", "宿命", "转折", "觉醒", "力量",
            "闪光", "剑", "魔杖", "圣物", "神器", "学院", "社团", "文化祭", "体育祭",
            "制服", "眼镜", "双马尾", "呆毛", "女仆", "执事", "学生会", "死神", "恶魔",
            "天使", "妖怪", "灵魂", "转校生", "幼驯染", "青梅竹马", "吐槽"
        ]
        count = 0
        for term in anime_terms_list:
            count += text.count(term)
        return count
    
    def generate_comprehensive_report(self):
        """生成综合评估报告"""
        logger.info("开始生成综合评估报告...")
        
        # 收集所有评估结果
        all_scores = {}
        
        # 术语理解评估
        if "术语理解" not in self.results:
            self.evaluate_terminology()
        all_scores["术语理解"] = self.results["术语理解"]["总体得分"]
        
        # 文化知识评估
        if "文化知识" not in self.results:
            self.evaluate_cultural_knowledge()
        all_scores["文化知识"] = self.results["文化知识"]["总体得分"]
        
        # 角色表达评估
        if "角色表达" not in self.results:
            self.evaluate_character_expression()
        all_scores["角色表达"] = self.results["角色表达"]["总体得分"]
        
        # 创意写作评估
        if "创意写作" not in self.results:
            self.evaluate_creative_writing()
        all_scores["创意写作"] = self.results["创意写作"]["总体得分"]
        
        # 计算总体得分（权重可调整）
        weights = {
            "术语理解": 0.25,
            "文化知识": 0.25,
            "角色表达": 0.3,
            "创意写作": 0.2
        }
        
        weighted_score = sum(all_scores[k] * weights[k] for k in all_scores)
        
        # 生成评分等级
        grade = "S" if weighted_score >= 0.9 else \
                "A" if weighted_score >= 0.8 else \
                "B" if weighted_score >= 0.7 else \
                "C" if weighted_score >= 0.6 else \
                "D" if weighted_score >= 0.5 else "F"
        
        # 分析优势和劣势
        scores_list = [(k, v) for k, v in all_scores.items()]
        scores_list.sort(key=lambda x: x[1], reverse=True)
        strengths = [f"{item[0]}({item[1]:.2f})" for item in scores_list[:2]]
        weaknesses = [f"{item[0]}({item[1]:.2f})" for item in scores_list[-2:]]
        
        # 生成综合报告
        report = {
            "模型名称": self.adapter_path.name,
            "评估时间": self.timestamp,
            "分项得分": all_scores,
            "综合加权得分": weighted_score,
            "评分等级": grade,
            "优势领域": strengths,
            "待提升领域": weaknesses,
            "详细评估": self.results
        }
        
        # 保存报告
        report_path = self.output_dir / f"anime_evaluation_report_{self.timestamp}.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        # 生成可视化报告
        self.generate_visual_report(all_scores, weighted_score, grade)
        
        logger.info(f"综合评估报告已生成: {report_path}")
        return report
    
    def generate_visual_report(self, scores, weighted_score, grade):
        """生成可视化评估报告"""
        try:
            # 创建雷达图
            categories = list(scores.keys())
            values = [scores[cat] for cat in categories]
            
            # 添加首尾相连
            categories.append(categories[0])
            values.append(values[0])
            
            # 计算角度
            angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False).tolist()
            angles += angles[:1]  # 闭合
            
            fig, ax = plt.subplots(figsize=(10, 8), subplot_kw=dict(polar=True))
            ax.plot(angles, values, 'o-', linewidth=2, label="评分")
            ax.fill(angles, values, alpha=0.25)
            ax.set_thetagrids(np.degrees(angles[:-1]), categories[:-1])
            
            # 设置y轴范围
            ax.set_ylim(0, 1)
            ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
            ax.set_yticklabels(["0.2", "0.4", "0.6", "0.8", "1.0"])
            
            # 添加标题和标签
            plt.title(f"二次元能力评估 - 综合得分: {weighted_score:.2f} (等级 {grade})", size=15, y=1.1)
            
            # 保存图表
            chart_path = self.output_dir / f"anime_evaluation_chart_{self.timestamp}.png"
            plt.tight_layout()
            plt.savefig(chart_path)
            plt.close()
            
            logger.info(f"可视化评估报告已生成: {chart_path}")
        except Exception as e:
            logger.error(f"生成可视化报告失败: {e}")

def main():
    """主函数"""
    import argparse
    
    # 获取绝对路径
    root_path = Path(__file__).resolve().parent.parent
    default_config_path = root_path / "config" / "model_config.json"
    default_model_path = root_path / "output" / "final_model"
    default_output_dir = root_path / "evaluation_results"
    
    parser = argparse.ArgumentParser(description="二次元能力评估工具")
    parser.add_argument("--model_config", type=str, default=str(default_config_path), help="模型配置文件路径")
    parser.add_argument("--model_path", type=str, default=str(default_model_path), help="要评估的模型路径")
    parser.add_argument("--output_dir", type=str, default=str(default_output_dir), help="评估结果输出目录")
    parser.add_argument("--eval_type", type=str, choices=["all", "terminology", "knowledge", "expression", "writing"], 
                        default="all", help="评估类型，可选特定维度或all进行全面评估")
    
    args = parser.parse_args()
    
    logger.info("="*50)
    logger.info("启动二次元能力评估工具")
    logger.info(f"模型配置: {args.model_config}")
    logger.info(f"评估模型: {args.model_path}")
    logger.info(f"评估类型: {args.eval_type}")
    logger.info("="*50)
    
    # 初始化评估器
    evaluator = AnimeEvaluator(
        model_config_path=Path(args.model_config),
        adapter_path=Path(args.model_path)
    )
    evaluator.output_dir = Path(args.output_dir)
    evaluator.output_dir.mkdir(exist_ok=True)
    
    # 打印实际使用的路径，便于调试
    logger.info(f"使用配置文件路径: {Path(args.model_config).absolute()}")
    logger.info(f"使用模型路径: {Path(args.model_path).absolute()}")
    logger.info(f"使用输出目录: {Path(args.output_dir).absolute()}")
    
    try:
        if args.eval_type == "all":
            # 执行全面评估
            logger.info("开始全面评估...")
            evaluator.evaluate_terminology()
            evaluator.evaluate_cultural_knowledge()
            evaluator.evaluate_character_expression()
            evaluator.evaluate_creative_writing()
            report = evaluator.generate_comprehensive_report()
            
            # 打印总结
            print("\n" + "="*50)
            print(f"二次元能力综合评估完成！")
            print(f"综合得分: {report['综合加权得分']:.4f}")
            print(f"评分等级: {report['评分等级']}")
            print("\n分项得分:")
            for category, score in report['分项得分'].items():
                print(f"  {category}: {score:.4f}")
            print(f"\n优势领域: {', '.join(report['优势领域'])}")
            print(f"待提升领域: {', '.join(report['待提升领域'])}")
            print(f"\n详细报告已保存至: {evaluator.output_dir}")
            print("="*50)
            
        else:
            # 执行特定维度评估
            if args.eval_type == "terminology":
                score = evaluator.evaluate_terminology()
                print(f"\n术语理解评估得分: {score:.4f}")
            elif args.eval_type == "knowledge":
                score = evaluator.evaluate_cultural_knowledge()
                print(f"\n文化知识评估得分: {score:.4f}")
            elif args.eval_type == "expression":
                score = evaluator.evaluate_character_expression()
                print(f"\n角色表达评估得分: {score:.4f}")
            elif args.eval_type == "writing":
                score = evaluator.evaluate_creative_writing()
                print(f"\n创意写作评估得分: {score:.4f}")
                
    except Exception as e:
        logger.error(f"评估过程中发生错误: {e}", exc_info=True)
        print(f"\n评估过程中发生错误: {e}")
        print("请查看日志文件获取详细错误信息。")

if __name__ == "__main__":
    main()