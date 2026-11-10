package com.logdetective.freellm;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "freellm")
public class FreeLlmProperties {

	private String baseUrl = "";

	private String model = "";

	private String apiKey = "";

	private Duration connectTimeout = Duration.ofSeconds(5);

	private Duration readTimeout = Duration.ofSeconds(60);

	public String getBaseUrl() {
		return baseUrl;
	}

	public void setBaseUrl(String baseUrl) {
		this.baseUrl = baseUrl;
	}

	public String getModel() {
		return model;
	}

	public void setModel(String model) {
		this.model = model;
	}

	public String getApiKey() {
		return apiKey;
	}

	public void setApiKey(String apiKey) {
		this.apiKey = apiKey;
	}

	public Duration getConnectTimeout() {
		return connectTimeout;
	}

	public void setConnectTimeout(Duration connectTimeout) {
		this.connectTimeout = connectTimeout;
	}

	public Duration getReadTimeout() {
		return readTimeout;
	}

	public void setReadTimeout(Duration readTimeout) {
		this.readTimeout = readTimeout;
	}

	public boolean isConfigured() {
		return isPresent(baseUrl) && isPresent(model) && isPresent(apiKey);
	}

	private static boolean isPresent(String value) {
		return value != null && !value.isBlank();
	}

	@Override
	public String toString() {
		return "FreeLlmProperties[configured=" + isConfigured() + "]";
	}

}
