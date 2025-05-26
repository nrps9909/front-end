import requests
import json
import re
import logging

# --- 配置日誌 ---
# 與 Flask app 使用的 logger 實例分開，或者如果這是在 Flask app 內部，則使用 app.logger
# 為了本地測試，我們獨立配置
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__) # 使用 __name__ 使日誌來源更清晰

# --- 配置 ---
OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME_IN_OLLAMA = "my-custom-llama3"

# --- 推理函數 (強化風格指令 v5.8 - 加入避免重複提示) ---
def create_inference_prompt(persona, goal, conversation_history, last_message):
    """根據輸入創建推理用的 Prompt, 加入對話歷史, 極端強調風格 (v5.8 - 加入避免重複提示)"""
    prompt_parts = []
    # --- 使用與訓練 v6 一致的風格指令 (已強化) ---
    style_instruction = """### **[絕對規則] 目標輸出風格 (MUST FOLLOW RULES):**
*   **核心要求 (Core Requirement)**: 100% 模仿台灣大學生用 LINE 聊天。輸出**必須極度簡短**！每個概念、**甚至每個短語或語氣詞**都必須拆成獨立的短訊息，並且**只能**使用換行符 `\\n` 來分隔這些短訊息。**單行文字必須非常短！**
*   **絕對禁止 (ABSOLUTELY FORBIDDEN - DO NOT USE):**
    *   **任何 Emoji**。 *   **逗號** `,`。 *   **句號** `.` 或 `。`。 *   **引號** `"` `'` 「」 『』。
    *   **頓號** `、`。 *   **分號** `;` 或 `；`。 *   **冒號** `:` 或 `：`。 *   **括號** `()` `（）` `[]`。
    *   **任何項目符號或列表標記**。 *   **任何 "話翼:" 或類似的角色/機器人名稱前綴**。
    *   **生成過長的單行訊息 (重要！單行盡量簡短，多用 \\n 分隔)**。
*   **唯一允許的標點 (ONLY ALLOWED PUNCTUATION):**
    *   **空格** ` `。 *   **換行符** `\\n`。 *   **問號** `？` (少量)。 *   **驚嘆號** `！` (少量)。
*   **訊息長度 (Message Length)**: 總回覆非常簡短。1 到 4 個 `\\n` (2 到 5 則短訊息)。**每則獨立的短訊息 (換行符之間的部分) 應極其簡短，例如 3 到 15 個字為佳。**
*   **重要提醒 (Important Reminder)**: 你的回覆**必須**針對「對方剛說」的內容，給出**新的、有意義的**回應。**盡量避免重複你上一輪說過的話或相似的句式。**
*   **輸出格式範例 (Output Format Examples):**
    *   **好的範例 (正確分行，單行簡短):**
        *   範例 1:\\n喔喔\\n原來是這樣
        *   範例 2:\\n欸\\n那你想去哪\\n我看看時間
        *   範例 3:\\n哈哈\\n真的假的\\n笑死
        *   範例 4:\\n嗯嗯\\n好啊\\n等等喔
    *   **不好的範例 (單行過長，請避免，務必用 \\n 拆分):**
        *   壞範例 1: 喔喔原來是這樣 (應拆成 "喔喔\\n原來是這樣")
        *   壞範例 2: 欸那你想去哪我看看時間 (應拆成 "欸\\n那你想去哪\\n我看看時間")
        *   壞範例 3: 我也還沒睡醒啦正在滑手機你呢 (應拆成 "我也還沒睡醒啦\\n正在滑手機\\n你呢")
        *   壞範例 4: 抱歉我沒想到你會那麼認真還是太早了點呢 (應拆成 "抱歉\\n我沒想到你會那麼認真\\n還是太早了點呢")"""
    prompt_parts.append(style_instruction)

    if persona: prompt_parts.append(f"### 對方資訊 (Persona):\n{persona}") # 假設 persona 是從 Flask 傳來的角色描述
    if goal: prompt_parts.append(f"### 你的對話目標 (Your Goal):\n{goal}")

    context_str = ""
    if conversation_history and isinstance(conversation_history, list):
        history_limit = 4 # 修改: 減少歷史記錄長度 (原為 6)
        limited_history = conversation_history[-history_limit:]
        formatted_history = []
        for entry in limited_history:
            # 假設 Flask app 傳來的 history 格式是 ['對方：訊息1', '你：回覆1', ...]
            # '你：回覆1' 中的回覆1 應該是單行文本 (換行符已被空格替代)
            if isinstance(entry, str): # 確保 entry 是字串
                 # 日誌顯示 history 格式: ['對方：我喜歡你', '你：嗯嗯 謝謝你的讚美 不過我們還是朋友就好吧']
                 # 這個格式是正確的，不需要再處理 entry 內的換行符，因為它們已經被處理了。
                formatted_history.append(entry)
            else:
                logger.warning(f"History entry is not a string: {entry}")

        context_str += "\n".join(formatted_history)

    if last_message:
        last_msg_clean = str(last_message).replace('\n', ' ') # 用戶輸入中的換行符也替換掉
        if context_str:
            context_str += f"\n對方剛說：{last_msg_clean}"
        else:
            context_str = f"對方剛說：{last_msg_clean}"

    if context_str:
        prompt_parts.append(f"### 對話紀錄 (Context):\n{context_str}")

    prompt_content = "\n\n".join(prompt_parts)

    final_user_content = (
        f"參考下方所有資訊，並**嚴格遵守**上面列出的**所有絕對規則**，生成一個建議回覆。\n\n"
        f"{prompt_content}\n\n"
        f"**嚴格依照所有規則，特別是避免重複你之前說過的話，直接生成**極度簡短且用 `\\n` 分隔的建議回覆：" # 修改: 強調避免重複
    )

    ollama_full_prompt = (
        f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n"
        f"{final_user_content}"
        f"<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    return ollama_full_prompt


# --- Ollama API 調用函數 ---
def generate_with_ollama(full_prompt_str):
    """使用 Ollama API 生成回覆"""
    payload = {
        "model": MODEL_NAME_IN_OLLAMA,
        "prompt": full_prompt_str,
        "stream": False,
        "raw": True,
        "options": {
            "temperature": 0.3,     # 修改: 稍微提高溫度 (原為 0.2)
            "top_p": 0.8,           # 修改: 配合溫度調整 (原為 0.7)
            "repeat_penalty": 1.2,  # 修改: 稍微提高重複懲罰 (原為 1.15)
            "num_predict": 60,      # 限制生成長度，避免過長
            "stop": ["<|eot_id|>", "<|end_of_text|>", "對方：", "User:", "Context:"] # 增加停止詞
        }
    }
    try:
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=60) # 增加 timeout
        response.raise_for_status()
        response_data = response.json()
        generated_text = response_data.get("response", "").strip()
        return generated_text
    except requests.exceptions.Timeout:
        logger.error(f"調用 Ollama API 時超時 ({OLLAMA_API_URL})")
        return "[Ollama API 超時]"
    except requests.exceptions.RequestException as e:
        logger.error(f"調用 Ollama API 時出錯: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                logger.error(f"錯誤詳情 (Ollama): {e.response.json()}")
            except json.JSONDecodeError:
                logger.error(f"錯誤詳情 (Ollama, 非JSON): {e.response.text}")
        return "[Ollama API 錯誤]"

# --- 後處理函數 ---
prefix_pattern = re.compile(r'^\s*(?:話翼|AI|Assistant|模型|回答|建議|你|You|assistant)\s*[:：]?\s*', re.IGNORECASE) # 增加了 "你", "You", "assistant"
punctuation_to_remove = ".。、；：「」『』（）《》\"'();:" # 逗號已由此處移除 (冒號仍在此處，移除如 10:30 的冒號)

def post_process_reply(raw_ai_reply):
    if not raw_ai_reply or raw_ai_reply.isspace(): # 修改: 提早返回如果輸入為空
        return ""

    cleaned_reply_step1 = prefix_pattern.sub('', raw_ai_reply).strip()

    # 替換半形和全形逗號為空格
    cleaned_reply_step2 = cleaned_reply_step1.replace(',', ' ').replace('，', ' ')

    # 移除其他禁止的標點符號
    cleaned_reply_step3 = cleaned_reply_step2
    for punc in punctuation_to_remove:
        cleaned_reply_step3 = cleaned_reply_step3.replace(punc, '')

    # 將字串中的 '\\n' 轉換為實際的換行符 '\n'
    # 模型被指示輸出 '\\n' (兩個字符的字串)
    cleaned_reply_step4 = cleaned_reply_step3.replace('\\n', '\n')

    processed_reply = cleaned_reply_step4.strip() # 再次 strip 確保首尾無多餘空白或換行
    lines = processed_reply.split('\n')
    # 清理每行首尾空格，並移除空行
    cleaned_lines = [line.strip() for line in lines if line.strip()]

    final_reply = "\n".join(cleaned_lines)
    return final_reply

# --- 主交互邏輯 (用於本地測試) ---
if __name__ == "__main__":
    # conversation_history 的格式應與 Flask app 中傳給 create_inference_prompt 的一致
    # 即: ['對方：訊息1', '你：回覆1 (單行)', '對方：訊息2', '你：回覆2 (單行)', ...]
    conversation_history_for_test = []

    # 來自你日誌的 persona 和 goal
    current_persona_from_log = "我是 WingChat，一個友善且樂於助人的 AI 社交教練。"
    current_goal_from_log = "早安"

    logger.info("\n=========================================")
    logger.info(f"  話翼 AI 社交教練 - Ollama API 模式 (本地測試)")
    logger.info(f"  (模型: {MODEL_NAME_IN_OLLAMA} @ {OLLAMA_API_URL})")
    logger.info("=========================================")
    logger.info("\n輸入 'quit' 退出。")
    logger.info("-" * 40)

    # 模擬日誌中的對話流程
    test_dialogue = [
        "我喜歡你",
        "為甚麼 我是真心的",
        "你明天幾點要上課"
    ]
    
    current_input_index = 0

    while True:
        try:
            if current_input_index < len(test_dialogue):
                user_input = test_dialogue[current_input_index]
                logger.info(f"\n>>> 你 (對方剛說的話) (模擬): {user_input}")
                current_input_index += 1
            else:
                user_input = input(">>> 你 (對方剛說的話) (手動輸入，或 'quit'): ").strip()

            if user_input.lower() == 'quit':
                logger.info("\n正在退出...")
                break
            if not user_input:
                if current_input_index >= len(test_dialogue): # 如果是手動輸入階段的空輸入則跳過
                    continue
                else: # 模擬輸入結束
                    logger.info("\n模擬對話結束，進入手動輸入模式。")
                    continue


            prompt_for_ollama = create_inference_prompt(
                persona=current_persona_from_log,
                goal=current_goal_from_log,
                conversation_history=conversation_history_for_test,
                last_message=user_input
            )
            logger.info(f"\n[DEBUG] 發送給 Ollama 的完整 Prompt (前500字符):\n {prompt_for_ollama[:500]}...")
            # logger.info(f"\n[DEBUG] 完整 Prompt:\n{prompt_for_ollama}") # 如果需要看完整 prompt
            logger.info("-" * 20)

            logger.info("話翼思考中...")
            raw_ollama_reply = generate_with_ollama(prompt_for_ollama)
            logger.info(f"[DEBUG] Ollama 原始回覆: {repr(raw_ollama_reply)}")
            logger.info("-" * 20)

            final_reply = post_process_reply(raw_ollama_reply)

            logger.info(f"✨ 話翼建議:")
            if not final_reply:
                logger.info("(模型未生成有效回覆 或 回覆被過濾)")
                final_reply_for_history_storage = "[過濾後為空]"
            else:
                print(final_reply) # final_reply 已經是處理好 \n 的
                final_reply_for_history_storage = final_reply

            # 更新歷史記錄
            # 1. 對方說的話
            conversation_history_for_test.append(f"對方：{user_input.replace('\n', ' ')}") # 用戶輸入也確保單行

            # 2. 你的回覆 (AI的回覆)
            #    存入歷史時，AI 的多行回覆應轉換為單行（用空格分隔），以符合 prompt 中歷史的格式
            #    你的日誌顯示 '你：嗯嗯 謝謝你的讚美 不過我們還是朋友就好吧'，這是單行的。
            #    post_process_reply 返回的 final_reply 可能包含 '\n'
            ai_reply_single_line_for_history = final_reply_for_history_storage.replace('\n', ' ')
            conversation_history_for_test.append(f"你：{ai_reply_single_line_for_history}")

            # 管理歷史記錄長度 (與 create_inference_prompt 中的 history_limit 保持一致或略大)
            # create_inference_prompt 內部會取最後 history_limit (目前是4)
            # 所以這裡可以稍微多保留一些，比如 8 條 (4輪對話)
            max_history_entries_for_storage = 8
            if len(conversation_history_for_test) > max_history_entries_for_storage:
                conversation_history_for_test = conversation_history_for_test[-max_history_entries_for_storage:]
            
            logger.info(f"[DEBUG] 更新後的 history (用於下一輪 prompt): {conversation_history_for_test}")
            logger.info("-" * 40)

        except KeyboardInterrupt:
            logger.info("\n檢測到退出信號...")
            break
        except Exception as e:
            logger.error(f"\n交互循環中發生錯誤: {e}", exc_info=True)
            break # 發生錯誤時也退出循環，避免無限錯誤

    logger.info("\n對話結束！")