package com.logdetective.freellm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.util.List;
import java.util.concurrent.TimeoutException;

public class FreeLlmClient {

	static final String SYSTEM_MESSAGE = "You are a helpful assistant for AI Log Detective.";

	private static final Logger log = LoggerFactory.getLogger(FreeLlmClient.class);

	private final RestClient restClient;

	private final FreeLlmProperties properties;

	public FreeLlmClient(RestClient restClient, FreeLlmProperties properties) {
		this.restClient = restClient;
		this.properties = properties;
	}

	public String complete(String prompt) {
		if (!properties.isConfigured()) {
			throw new FreeLlmException(HttpStatus.SERVICE_UNAVAILABLE, "FreeLLM is not configured.");
		}

		URI endpoint = chatCompletionsUri();
		ChatCompletionRequest request = new ChatCompletionRequest(
			properties.getModel().trim(),
			List.of(
				new ChatMessage("system", SYSTEM_MESSAGE),
				new ChatMessage("user", prompt)
			)
		);

		try {
			ChatCompletionResponse response = restClient.post()
				.uri(endpoint)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey().trim())
				.contentType(MediaType.APPLICATION_JSON)
				.body(request)
				.retrieve()
				.body(ChatCompletionResponse.class);
			return generatedText(response);
		}
		catch (FreeLlmException exception) {
			throw exception;
		}
		catch (RestClientResponseException exception) {
			throw mapHttpStatus(exception.getStatusCode().value());
		}
		catch (ResourceAccessException exception) {
			log.warn("FreeLLM transport failure: {}", exception.getClass().getSimpleName());
			if (isTimeout(exception)) {
				throw new FreeLlmException(HttpStatus.GATEWAY_TIMEOUT, "FreeLLM request timed out.");
			}
			throw new FreeLlmException(HttpStatus.BAD_GATEWAY, "FreeLLM request failed.");
		}
		catch (RestClientException exception) {
			log.warn("FreeLLM response failure: {}", exception.getClass().getSimpleName());
			throw new FreeLlmException(HttpStatus.BAD_GATEWAY, "FreeLLM request failed.");
		}
	}

	private URI chatCompletionsUri() {
		String baseUrl = properties.getBaseUrl().trim();
		while (baseUrl.endsWith("/")) {
			baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
		}
		URI base;
		try {
			base = URI.create(baseUrl);
		}
		catch (IllegalArgumentException exception) {
			throw new FreeLlmException(HttpStatus.SERVICE_UNAVAILABLE, "FreeLLM base URL is invalid.");
		}
		String scheme = base.getScheme();
		if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
			throw new FreeLlmException(HttpStatus.SERVICE_UNAVAILABLE, "FreeLLM base URL is invalid.");
		}
		return URI.create(baseUrl + "/chat/completions");
	}

	private String generatedText(ChatCompletionResponse response) {
		if (response == null || response.choices() == null || response.choices().isEmpty()) {
			throw new FreeLlmException(HttpStatus.BAD_GATEWAY, "FreeLLM returned an empty response.");
		}
		ChatMessage message = response.choices().getFirst().message();
		if (message == null || message.content() == null || message.content().isBlank()) {
			throw new FreeLlmException(HttpStatus.BAD_GATEWAY, "FreeLLM returned an empty response.");
		}
		return message.content();
	}

	private FreeLlmException mapHttpStatus(int status) {
		log.warn("FreeLLM HTTP status {}", status);
		return switch (status) {
			case 401 -> new FreeLlmException(HttpStatus.UNAUTHORIZED, "FreeLLM authentication failed.");
			case 429 -> new FreeLlmException(HttpStatus.TOO_MANY_REQUESTS, "FreeLLM rate limit exceeded. Try again later.");
			default -> new FreeLlmException(HttpStatus.BAD_GATEWAY, "FreeLLM request failed.");
		};
	}

	private boolean isTimeout(Throwable error) {
		Throwable current = error;
		while (current != null) {
			if (current instanceof TimeoutException) {
				return true;
			}
			String name = current.getClass().getName();
			if (name.endsWith("TimeoutException") || name.endsWith("SocketTimeoutException")) {
				return true;
			}
			current = current.getCause();
		}
		return false;
	}

	private record ChatCompletionRequest(String model, List<ChatMessage> messages) {
	}

	private record ChatMessage(String role, String content) {
	}

	private record ChatCompletionResponse(List<Choice> choices) {

		private record Choice(ChatMessage message) {
		}
	}

}
