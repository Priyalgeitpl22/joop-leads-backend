import { AIResponse } from "../interfaces";

export const getAIResponse = async (message: string, organisationId: string) => {
  try {
    const url = `http://44.208.33.109/api/organisation_chatbot/?organisation_id=123`;

    const requestBody = JSON.stringify({ user_query: message });
    console.log("Sending request:", url, requestBody); // Debugging log

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as AIResponse;
  } catch (error) {
    console.error("Error fetching AI response:", error);
    throw new Error("AI response failed");
  }
};
