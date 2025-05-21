import requests
import json
import re

# --- 配置 ---
OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME_IN_OLLAMA = "my-custom-llama3"

# --- 推理函數 (強化風格指令) ---
def create_inference_prompt(persona, goal, conversation_history, last_message):
    """根據輸入創建推理用的 Prompt, 加入對話歷史, 極端強調風格 (v5.7 - 強化風格指令)"""
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
*   **輸出格式範例 (Output Format Examples):**
    *   **好的範例 (正確分行，單行簡短):**
        *   範例 1:\n喔喔\n原來是這樣
        *   範例 2:\n欸\n那你想去哪\n我看看時間
        *   範例 3:\n哈哈\n真的假的\n笑死
        *   範例 4:\n嗯嗯\n好啊\n等等喔
    *   **不好的範例 (單行過長，請避免，務必用 \\n 拆分):**
        *   壞範例 1: 喔喔原來是這樣 (應拆成 "喔喔\\n原來是這樣")
        *   壞範例 2: 欸那你想去哪我看看時間 (應拆成 "欸\\n那你想去哪\\n我看看時間")
        *   壞範例 3: 我也還沒睡醒啦正在滑手機你呢 (應拆成 "我也還沒睡醒啦\\n正在滑手機\\n你呢")
        *   壞範例 4: 抱歉我沒想到你會那麼認真還是太早了點呢 (應拆成 "抱歉\\n我沒想到你會那麼認真\\n還是太早了點呢")"""
    prompt_parts.append(style_instruction)

    if persona: prompt_parts.append(f"### 對方資訊 (Persona):\n{persona}")
    if goal: prompt_parts.append(f"### 你的對話目標 (Your Goal):\n{goal}")

    context_str = ""
    if conversation_history and isinstance(conversation_history, list):
        history_limit = 6
        limited_history = conversation_history[-history_limit:]
        formatted_history = []
        for entry in limited_history:
            if entry.startswith("對方："):
                formatted_history.append(entry)
            elif entry.startswith("話翼："):
                simplified_reply = entry[len("話翼："):].strip().replace('\n', ' ')
                formatted_history.append(f"你：{simplified_reply}")
            else:
                formatted_history.append(entry)
        context_str += "\n".join(formatted_history)

    if last_message:
        last_msg_clean = str(last_message).replace('\n', ' ')
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
        f"**嚴格依照所有規則，直接生成**極度簡短且用 `\\n` 分隔的建議回覆："
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
            "temperature": 0.2, # 嘗試稍微降低溫度以獲取更嚴格的格式遵循
            "top_p": 0.7,
            "repeat_penalty": 1.15,
            "num_predict": 60,
            "stop": ["<|eot_id|>", "<|end_of_text|>"]
        }
    }
    try:
        response = requests.post(OLLAMA_API_URL, json=payload)
        response.raise_for_status()
        response_data = response.json()
        generated_text = response_data.get("response", "").strip()
        return generated_text
    except requests.exceptions.RequestException as e:
        print(f"調用 Ollama API 時出錯: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print("錯誤詳情:", e.response.json())
            except json.JSONDecodeError:
                print("錯誤詳情 (非JSON):", e.response.text)
        return "[Ollama API 錯誤]"

# --- 後處理函數 ---
prefix_pattern = re.compile(r'^\s*(?:話翼|AI|Assistant|模型|回答|建議)\s*[:：]?\s*', re.IGNORECASE)
punctuation_to_remove = ".。、；：「」『』（）《》\"'();:" # 逗號已由此處移除

def post_process_reply(raw_ai_reply):
    cleaned_reply_step1 = prefix_pattern.sub('', raw_ai_reply).strip()
    
    # 替換半形和全形逗號為空格
    cleaned_reply_step2 = cleaned_reply_step1.replace(',', ' ')
    cleaned_reply_step2 = cleaned_reply_step2.replace('，', ' ')

    # 移除其他禁止的標點符號
    cleaned_reply_step3 = cleaned_reply_step2
    for punc in punctuation_to_remove:
        cleaned_reply_step3 = cleaned_reply_step3.replace(punc, '')
    
    # 將字串中的 '\\n' 轉換為實際的換行符 '\n'
    cleaned_reply_step4 = cleaned_reply_step3.replace('\\n', '\n')
    
    processed_reply = cleaned_reply_step4
    lines = processed_reply.split('\n')
    # 清理每行首尾空格，並移除空行
    cleaned_lines = [line.strip() for line in lines if line.strip()]
    
    final_reply = "\n".join(cleaned_lines)
    return final_reply

# --- 主交互邏輯 ---
if __name__ == "__main__":
    conversation_history = []
    current_persona = "25歲正在就讀科技法律研究所的女生，大學是吉他社，很喜歡日本文化，安全型人格，住在台北，討厭把家庭順位放太高的男生，討厭父權男，不喜歡在小事情上計較"
    current_goal = "目前我跟這個女生是朋友，我想要跟他變成更好的朋友"

    print("\n=========================================")
    print(f"  話翼 AI 社交教練 - Ollama API 模式")
    print(f"  (模型: {MODEL_NAME_IN_OLLAMA} @ {OLLAMA_API_URL})")
    print("=========================================")
    print("\n輸入 'quit' 退出。")
    print("-" * 40)

    while True:
        try:
            user_input = input(">>> 你 (對方剛說的話): ").strip()
            if user_input.lower() == 'quit':
                print("\n正在退出...")
                break
            if not user_input:
                continue

            full_prompt = create_inference_prompt(
                persona=current_persona,
                goal=current_goal,
                conversation_history=conversation_history,
                last_message=user_input
            )
            print("\n[DEBUG] 發送給 Ollama 的完整 Prompt (前400字符，檢查 style_instruction 是否完整):\n", full_prompt[:400] + "...") # 增加顯示長度以確認
            print("-" * 20)
            
            print("話翼思考中...")
            raw_ollama_reply = generate_with_ollama(full_prompt)
            print("[DEBUG] Ollama 原始回覆:", repr(raw_ollama_reply))
            print("-" * 20)

            final_reply = post_process_reply(raw_ollama_reply)

            print(f"\n✨ 話翼建議:")
            if not final_reply:
                print("(模型未生成有效回覆 或 回覆被過濾)")
                final_reply_for_history = "[過濾後為空]"
            else:
                print(final_reply)
                final_reply_for_history = final_reply
            
            conversation_history.append(f"對方：{user_input}")
            conversation_history.append(f"話翼：{final_reply_for_history}")
            history_limit = 8
            if len(conversation_history) > history_limit:
                conversation_history = conversation_history[-history_limit:]

        except KeyboardInterrupt:
            print("\n檢測到退出信號...")
            break
        except Exception as e:
            print(f"\n交互循環中發生錯誤: {e}")
            import traceback
            traceback.print_exc()

    print("\n對話結束！")