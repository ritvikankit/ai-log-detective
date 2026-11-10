package com.logdetective.controller;

import com.logdetective.freellm.FreeLlmClient;
import com.logdetective.freellm.FreeLlmException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AiTestControllerTest {

	@Mock
	private FreeLlmClient freeLlmClient;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new AiTestController(freeLlmClient))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
	}

	@Test
	void testReturnsGeneratedText() throws Exception {
		when(freeLlmClient.complete("Say hello")).thenReturn("Hello from the model.");

		mockMvc.perform(post("/api/ai/test")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"prompt":"Say hello"}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.text").value("Hello from the model."));
	}

	@Test
	void testRejectsBlankPrompt() throws Exception {
		mockMvc.perform(post("/api/ai/test")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"prompt":"  "}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error").value("Prompt is required."));
	}

	@Test
	void testReturnsProviderErrorBody() throws Exception {
		when(freeLlmClient.complete("Say hello"))
			.thenThrow(new FreeLlmException(HttpStatus.UNAUTHORIZED, "FreeLLM authentication failed."));

		mockMvc.perform(post("/api/ai/test")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"prompt":"Say hello"}
					"""))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.error").value("FreeLLM authentication failed."));
	}

}
