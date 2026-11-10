package com.logdetective.freellm;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class FreeLlmConfig {

	@Bean
	RestClient freeLlmRestClient(FreeLlmProperties properties) {
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(properties.getConnectTimeout());
		requestFactory.setReadTimeout(properties.getReadTimeout());
		return RestClient.builder()
			.requestFactory(requestFactory)
			.build();
	}

	@Bean
	FreeLlmClient freeLlmClient(RestClient freeLlmRestClient, FreeLlmProperties properties) {
		return new FreeLlmClient(freeLlmRestClient, properties);
	}

}
