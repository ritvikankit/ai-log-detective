package com.logdetective.freellm;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

class FreeLlmClientTest {

	private static final String ENDPOINT = "http://localhost:3001/v1/chat/completions";

	private FreeLlmProperties properties;

	private MockRestServiceServer server;

	private FreeLlmClient client;

	@BeforeEach
	void setUp() {
		properties = new FreeLlmProperties();
		properties.setBaseUrl("http://localhost:3001/v1");
		properties.setModel("test-model");
		properties.setApiKey("test-key");

		RestClient.Builder builder = RestClient.builder();
		server = MockRestServiceServer.bindTo(builder).build();
		client = new FreeLlmClient(builder.build(), properties);
	}

	@Test
	void completeSendsPromptAndReturnsGeneratedText() {
		server.expect(requestTo(ENDPOINT))
			.andExpect(method(HttpMethod.POST))
			.andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-key"))
			.andExpect(content().contentType(MediaType.APPLICATION_JSON))
			.andExpect(content().json("""
				{
				  "model": "test-model",
				  "messages": [
				    {"role": "system", "content": "%s"},
				    {"role": "user", "content": "Explain a timeout"}
				  ]
				}
				""".formatted(FreeLlmClient.SYSTEM_MESSAGE), JsonCompareMode.STRICT))
			.andRespond(withSuccess("""
				{"choices":[{"message":{"role":"assistant","content":"A timeout means the call took too long."}}]}
				""", MediaType.APPLICATION_JSON));

		String text = client.complete("Explain a timeout");

		assertThat(text).isEqualTo("A timeout means the call took too long.");
		server.verify();
	}

	@Test
	void completeMapsUnauthorized() {
		expectStatus(UNAUTHORIZED.value(), """
			{"error":{"message":"bad key"}}
			""");

		assertThatThrownBy(() -> client.complete("hello"))
			.isInstanceOf(FreeLlmException.class)
			.hasMessage("FreeLLM authentication failed.")
			.extracting(error -> ((FreeLlmException) error).getStatus().value())
			.isEqualTo(401);
	}

	@Test
	void completeMapsRateLimit() {
		expectStatus(TOO_MANY_REQUESTS.value(), """
			{"error":{"message":"slow down","code":"quota_exceeded"}}
			""");

		assertThatThrownBy(() -> client.complete("hello"))
			.isInstanceOf(FreeLlmException.class)
			.hasMessage("FreeLLM rate limit exceeded. Try again later.")
			.extracting(error -> ((FreeLlmException) error).getStatus().value())
			.isEqualTo(429);
	}

	@Test
	void completeMapsProviderError() {
		server.expect(requestTo(ENDPOINT))
			.andRespond(withServerError().body("""
				{"error":{"message":"upstream failed"}}
				""").contentType(MediaType.APPLICATION_JSON));

		assertThatThrownBy(() -> client.complete("hello"))
			.isInstanceOf(FreeLlmException.class)
			.hasMessage("FreeLLM request failed.")
			.extracting(error -> ((FreeLlmException) error).getStatus().value())
			.isEqualTo(502);
	}

	@Test
	void completeMapsTimeout() {
		server.expect(requestTo(ENDPOINT))
			.andRespond(withException(new SocketTimeoutException("read timed out")));

		assertThatThrownBy(() -> client.complete("hello"))
			.isInstanceOf(FreeLlmException.class)
			.hasMessage("FreeLLM request timed out.")
			.extracting(error -> ((FreeLlmException) error).getStatus().value())
			.isEqualTo(504);
	}

	@Test
	void completeDoesNotCallProviderWhenConfigurationIsMissing() {
		properties.setApiKey(" ");

		assertThatThrownBy(() -> client.complete("hello"))
			.isInstanceOf(FreeLlmException.class)
			.hasMessage("FreeLLM is not configured.");
		server.verify();
	}

	private void expectStatus(int status, String body) {
		server.expect(requestTo(ENDPOINT))
			.andRespond(withStatus(org.springframework.http.HttpStatusCode.valueOf(status))
				.body(body)
				.contentType(MediaType.APPLICATION_JSON));
	}

}
